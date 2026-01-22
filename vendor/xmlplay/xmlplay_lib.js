//~ xmlplay_lib, Revision: 181, Copyright (C) 2016-2025: Willem Vree, contributions Stéphane David.
//~ This program is free software; you can redistribute it and/or modify it under the terms of the
//~ GNU General Public License as published by the Free Software Foundation; either version 2 of
//~ the License, or (at your option) any later version.
//~ This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//~ without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//~ See the GNU General Public License for more details. <http://www.gnu.org/licenses/gpl.html>.

import * as sLib from './xmlplay_syn.js';

var allNotes = [];
var midiVol = [];       // volume for each voice from midi controller 7
var midiPan = [];       // panning for each voice from midi controller 10
var midiInstr = [];     // instrument for each voice from midi program
var midiUsedArr;
var gStaves;
var nVoices;
var stf2name;
var vce2stf;
var rMarks = [];    // a marker for each voice
var isvgPrev = [];  // svg index of each marker
var isvgAligned = -1;   // laatste regel die uitgelijnd werd
var alignActive = 0; // luister naar de scrollend gebeurtenis
var abcElm;
var iSeq;
var ntsSeq = [];
var barTimes = {};  // maattijden als herhalingen niet uitgevoerd worden
var deSvgs = [];
var deSvgGs = [];
var gScale = 1.0;
var ntsPos = {};    // {abc_char_pos -> nSvg, x, y, w, h}
var stfPos = [];    // [stfys for each svg]
var stfHgt = [];    // hoogte van een balk
var audioCtx, timer1, gAccTime, tmpElm;
var rolElm;         // de stippellijn
var metRects = 0;   // all notes marked with svg-rects
var putMarkExt;

function doModel (abctxt, opt, gTempo=120, debug, mapTab, logerr, putMarkExt_p) {
    var abc2svg;
    var errtxt = '';
    var BAR = 0, GRACE = 4, KEY = 5, METER = 6, NOTE = 8, REST = 10, TEMPO = 14, BLOCK = 16, BASE_LEN = 1536;
    var keySteps = [3,0,4,1,5,2,6];     // step values of the cycle of fifth
    var scaleSteps = [0,2,4,5,7,9,11];  // step values of the scale of C
    var swingOn = 0;    // swing aan voor kwartnoten
    var gTrans = [];
    var edo53 = 0;      // tuning: equal division of octave by 53

    function getStaves (voice_tb) {
        var xs = [];
        stf2name = {};  // wissen bij nieuwe muziek
        vce2stf = {};
        voice_tb.forEach (function (v, i) {
            if (xs [v.st]) xs [v.st].push (i); 
            else xs [v.st] = [i];
            if (v.clef.clef_octave) gTrans [i] = v.clef.clef_octave;
            stfHgt [v.st] = (v.stafflines || '|||||').length * 6 * (v.staffscale || 1);
            midiVol [i] = v.midictl && v.midictl [7];
            if (midiVol [i] == undefined) midiVol [i] = 100;
            midiPan [i] = v.midictl && v.midictl [10];
            if (midiPan [i] == undefined) midiPan [i] = 64;
            midiInstr [i] = v.instr ? v.instr : 0;
            if (i in opt.instList) midiInstr [i] = opt.instList [i];    // url-parameter gaat voor
            vce2stf [i] = v.st;
            if (!stf2name [v.st]) { stf2name [v.st] = v.nm || ''; }
        });
        return xs;
    }

    function errmsg (txt, line, col) {
        errtxt += txt + '\n';
    }

    function parseModel (ts_p, voice_tb, music_types) {
        function edo53cor (step) {
            var semi = [0, 2, 3, 5, 7, 8, 10];      // toonladder Amin (halve toonschreden)
            var komma = [0, 9, 13, 22, 31, 35, 44]; // idem, maar toonschreden in komma's t.o.v. A
            var i = (step + 2) % 7;                 // step == 0 => semi [3] == C
            return komma [i] * 12 / 53 - semi [i];
        }
        function setKey (v, keyrec) {       // voice, ABC key record
            var a, p, oct, step, sign, stappen, acctmp = {};
            var [sharp, flat] = edo53 ? [48/53, -60/53] : [1, -1];
            if (keyrec.extra) keyrec = curKey [v];  // reset sleutel na een voorslag
            var sharpness = keyrec.k_sf;    // index in cycle of fifth (keySteps)
            var keyaccs = keyrec.k_a_acc;   // array of accidentals
            acctmp [v] = [0,0,0,0,0,0,0];   // step modifications for the current key in voice v
            curKey [v] = keyrec;            // onthoud het hele keyrecord
            sign = sharpness >= 0;
            stappen = sign ? keySteps.slice (0, sharpness) : keySteps.slice (sharpness);   // steps modified by key
            for (step of stappen) { acctmp [v][step] = sign ? sharp : flat; }
            if (keyaccs) {
                for (a of keyaccs) {        // { acc: <int | [num, den]>, pit: ladderstap }
                    p = a.pit + 19          // C -> 5 * 7 = 35
                    step = p % 7;           // C -> 0
                    if (Number.isInteger (a.acc)) {
                        acctmp [v][step] = a.acc;
                    } else {
                        var [an, ad] = a.acc;
                        acctmp [v][step] = an / ad;
                    }
                }
            }
            acctab [v] = [];
            for (var o = 0; o < 9; ++o) {   // vul acctab voor 9 octaven
                acctab [v] = acctab [v].concat (acctmp [v]);
            }
        }
        function checkDecos (ts) {
            var has_orn = '';
            if (ts.a_dd) {
                for (var r of ts.a_dd) { // check all deco's
                    var vol = dyntab [r.name];  // volume of deco (if defined)
                    if (vol) {          // set all voices of staff to volume
                        gStaves [ts.st].forEach (function (vce) {
                            vceVol [vce] = vol; // array of current volumes
                        });
                    }
                    if (ornaments.includes (r.name)) has_orn = r.name;
                    if (r.name == 'swing') swingOn = 1;
                    if (r.name == 'swingoff') swingOn = 0;
                };
            }
            if (ts.a_gch) {
                ts.a_gch.forEach (function (t) { // check all text annotations
                    if (/swing/i.test (t.text)) swingOn = 1;
                    if (/straight/i.test (t.text)) swingOn = 0;
                });
            }
            var nt = ts.next;   // de volgende noot in dezelfde stem
            while (nt && nt.type != NOTE && nt.type != REST) nt = nt.next;
            if (ts.dur >= 192 && nt && nt.dur == 192 && nt.time % 384 != 0 && swingOn) {
                ts.dur += 64;   // verleng de huidige noot/rust
                nt.time += 64;  // volgende noot evenveel later
                nt.dur -= 64;   // volgende noot evenveel korter
            }
            return has_orn;     // naam van de versiering als aanwezig
        }
        function noot2mid (n, p, v) {
            var mnf, mn, cent, oct, step;
            if (gTrans [v]) p += gTrans [v];    // octaaf transpositie in sleutel
            if (n.acc != undefined && n.acc != 0) {
                if (Number.isInteger (n.acc)) {
                    acctab [v][p] = accTrans [n.acc];   // acctab wordt aan het eind van de maat gereset
                } else {
                    var [an, ad] = n.acc;
                    acctab [v][p] = an / ad;
                }
            }
            oct = Math.floor (p / 7);   // C -> 5
            step = p % 7;               // C -> 0
            mnf = oct * 12 + scaleSteps [step];
            if (edo53) mnf += edo53cor (step);   // makam rast scale
            mnf += acctab [v][p];       // temporary alterations, key-accidentals
            mn = Math.round (mnf)
            cent = 100 * (mnf - mn)
            return [mn, cent]
        }
        function compute_ornament (has_orn, n, p, v, arpeg_duur) {
            var nootop = noot2mid (n, p + 1, v);
            var nootneer = noot2mid (n, p - 1, v);
            var ardpeg_duur = arpeg_duur > 48 ? 48 : arpeg_duur;    // 48 == 100 msec bij tempo 75
            return { naam: has_orn, nop: nootop, nnr: nootneer, ard: arpeg_duur }
        }
        function voegVslg (voorslag, tijd, duur, deNoten) {
            var dvm = duur / (voorslag.ns.length + 1);  // max duur van iedere voorslagnoot
            if (opt.burak) voorslag.accia = true;
            if (voorslag.accia && dvm > 96) dvm = 96;   // 1/16
            for (var nv of voorslag.ns) {
                nv.t = tijd;
                deNoten.push (nv);
                var dv = nv.ns [0].dur;
                if (dv > dvm) {         // beperk duur voorslagakkoord
                    dv = dvm; 
                    for (var nx of nv.ns) nx.dur = dvm;
                }
                tijd += dv;
                duur -= dv;
            }
            return [tijd, duur]
        }
        function parseNotes (ts_p, nextsel = 'ts_next') {
            var deNoten = [];
            for (var ts = ts_p; ts; ts = ts [nextsel]) {
                var i, n, p, oct, step, mn, cent, mnf, noten = [], noot, fret, tuning, v, vid, nt, x;
                switch (ts.type) {
                case TEMPO:
                    var dtmp = ts.tempo_notes;
                    if (!dtmp) {                    // use the old Q:80 notation for a hidden tempo marking
                        var ttxt = abctxt.slice (ts.istart, ts.iend)    // get the abc tempo text
                        ttxt = ttxt.match (/\d+/)   // extract the number
                        if (ttxt) gTempo = 1 * ttxt [0]
                    } else {
                        dtmp = ts.tempo_notes.reduce (function (sum, x) { return sum + x; });
                        gTempo = ts.tempo * dtmp / 384;
                    }
                    break;
                case REST:
                    checkDecos (ts);
                    noot = { t: ts.time, mnum: -1, dur: ts.dur, orn: {} };
                    noten.push (noot);
                    deNoten.push ({ t: ts.time, ix: ts.istart, v: ts.v, ns: noten, inv: ts.invis, tmp: gTempo });
                    break;
                case NOTE:
                    var instr = midiInstr [ts.v];   // from %%MIDI program instr
                    if (ts.p_v.clef.clef_type == 'p') instr += 128;  // percussion
                    var has_orn = checkDecos (ts);
                    var tijd = ts.time; 
                    var duur = ts.dur;
                    var ard = duur / ts.notes.length;       // max duur arpeggio noten
                    if (voorslag [ts.v]) {
                        [tijd, duur] = voegVslg (voorslag [ts.v], tijd, duur, deNoten);
                    }
                    for (i = 0; i < ts.notes.length; ++i) { // parse all notes (chords)
                        n = ts.notes [i];
                        p = n.pit + 19;             // C -> 35 == 5 * 7, global step
                        v = ts.v;                   // voice number 0..
                        vid = ts.p_v.id;            // voice ID
                        vol = vceVol [v] || 60;     // 60 == !p! if no volume
                        var ornmnt = has_orn ? compute_ornament (has_orn, n, p, v, ard) : {};
                        [mn, cent] = noot2mid (n, p, v);
                        //~ if (n.midi) mn = n.midi;     // ABC toonhoogte
                        if (debug) {
                            mnf = mn + cent / 100
                            x = Math.round (mnf * 53 / 12 + 0.25)   // comm53 value
                            console.log (x, mnf, n.midi);
                        }
                        var mapNm = ts.p_v.map;
                        if (instr >= 128 && mapNm != 'MIDIdrum') {
                            nt = abctxt.substring (ts.istart, ts.iend);
                            nt = nt.match (/[=_^]*[A-Ga-g]/)[0];
                            x = mapTab [mapNm + nt];
                            if (x) mn = x;
                        }
                        if (mapNm == 'MIDIdrum') mn = n.midi
                        var mnused = instr * 128 + mn;
                        midiUsed [mnused] = 1;      // collect all used midinumbers

                        noot = { t: tijd, inst: instr, mnum: mn, cnt: cent, dur: duur, velo: vol, orn: ornmnt };
                        if (p in tied [v]) {
                            nt = tied [v][p];   // de bindende noot
                            if (tijd == nt.t + nt.dur) {
                                nt.dur += duur;   // verleng duur van bindende noot
                                if (!n.tie_ty) delete tied [v][p]; // geen verdere ties
                                noot.mnum = -1;     // noot alleen behandelen als rust
                            } else {
                                console.log ('wrong tie: ', v, nt.mnum % 127, nt.t / 384, nt.dur);
                                delete tied [v][p]; // binding van oude noot klopt niet
                                if (n.tie_ty) tied [v][p] = noot; // bewaar referentie nieuwe noot
                            }
                        } else if (n.tie_ty) {
                            tied [v][p] = noot; // bewaar referentie om later de duur te verlengen
                        }
                        noten.push (noot);
                    }
                    if (noten.length == 0) break;           // door ties geen noten meer over
                    deNoten.push ({ t: tijd, ix: ts.istart, v: ts.v, ns: noten, stf: ts.st, tmp: gTempo });
                    if (voorslag [ts.v]) delete voorslag [ts.v];
                    break;
                case GRACE:
                    noten = parseNotes (ts.extra, 'next');
                    if (noten.length) { // is nul als syntax fout in voorslag
                        v = noten [0].v
                        voorslag [v] = { ns: noten };
                        voorslag [v].accia = ts.sappo;
                    }
                    break;
                case KEY: setKey (ts.v, ts); break;         // set acctab to new key
                case BAR:
                    setKey (ts.v, curKey [ts.v]);           // reset acctab to current key
                    deNoten.push ({ t: ts.time, ix: ts.istart, v: ts.v, bt: ts.bar_type, tx: ts.text });
                    break;
                case METER:                         // ritme verandering: nog te doen !
                    //~ gBeats = parseInt (ts.a_meter [0].top);
                    break;
                case BLOCK:
                    if (ts.instr) midiInstr [ts.v] = ts.instr;
                    if (ts.ctrl == 7) midiVol [ts.v] = ts.val;
                    if (ts.ctrl == 10) midiPan [ts.v] = ts.val;
                    if (ts.v in opt.instList && ts.time == 0) { // url-parameter gaat voor, maar alleen aan het begin
                        midiInstr [ts.v] = opt.instList [ts.v];
                    }
                    if (ts.ctrl == 9) edo53 = ts.val == 53;
                }
            }
            return deNoten
        }
        const ornaments = ['trill','lowermordent','uppermordent','//','arpeggio'];
        var acctab = {}, curKey = {}, tied = {}, voorslag = {};
        var accTrans = {'-2':-2, '-1':-1, 0:0, 1:1, 2:2, 3:0};
        var diamap = '0,1-,1,1+,2,3,3,4,4,5,6,6+,7,8-,8,8+,9,10,10,11,11,12,13,13+,14'.split (',')
        var dyntab = {'ppp':30, 'pp':45, 'p':60, 'mp':75, 'mf':90, 'f':105, 'ff':120, 'fff':127}
        var vceVol = [], vol;
        var mtr = voice_tb [0].meter.a_meter;
        var gBeats = mtr.length ? parseInt (mtr [0].top) : 4;
        for (var v = 0; v < voice_tb.length; ++v) {
            var key = voice_tb [v].key;
            setKey (v, key);
            tied [v] = {};
        }
        var midiUsed = {};
        nVoices = voice_tb.length;
        gStaves = getStaves (voice_tb);
        allNotes = parseNotes (ts_p);
        allNotes.sort ((a, b) => a.t - b.t);
        midiUsedArr = Object.keys (midiUsed);   // global used in laadNoot
    }

    if (abctxt.indexOf ('temperamentequal 53') >= 0) edo53 = 1;
    if (putMarkExt_p) {
        metRects = 1;    // wordt gebruikt in mkNtsSeq
        putMarkExt = putMarkExt_p;
    }
    var user = {
        'img_out': null, // img_out,
        'errmsg': errmsg,
        'read_file': function (x) { return ''; },   // %%abc-include, unused
        'anno_start': null, // svgInfo,
        'get_abcmodel': parseModel
    }
    abc2svg = new Abc (user);
    abc2svg.tosvg ('play', '%%play');   // houdt rekening met transpose= in K: of V:
    abc2svg.tosvg ('abc2svg', abctxt);
    if (errtxt == '') errtxt = 'no error';
    logerr (errtxt.trim ());
    rMarks.forEach (function (mark) {   // verwijder oude markeringen
        var pn = mark.parentNode;
        if (pn) pn.removeChild (mark);
    });
    isvgPrev = [];                      // clear svg indexes
    var kleur = ['#f9f','#3cf','#c99','#f66','#fc0','#cc0','#ccc'];
    for (var i = 0; i < nVoices; ++i) { // a marker for each voice
        var alpha = 1 << i & opt.curmsk ? '0' : ''
        var rMark = document.createElementNS ('http://www.w3.org/2000/svg','rect');
        rMark.setAttribute ('fill', kleur [i % kleur.length] + alpha);
        rMark.setAttribute ('fill-opacity', '0.5');
        rMark.setAttribute ('width', '0');  // omdat <rect> geen standaard HTML element is werkt rMark.width = 0 niet.
        rMarks.push (rMark);
        isvgPrev.push (-1);
    }
}

function doLayout (abctxt, opt, abc_elm, fplay, abcElm_p, logerr, addUnlockListener,
                    get_playing, playBack, dolayout) {
    var abc2svg;
    var muziek = '';
    var errtxt = '';
    var nSvg = 0;
    var stfys = {}; // y coors of the bar lines in a staff
    var xleft, xright, xleftmin = 1000, xrightmax = 0;
    var curStaff = 0;
    abcElm = abcElm_p;
    abcElm.style ['scroll-behavior'] = opt.nosm ? 'auto' : 'smooth';
    document.scrollingElement.style ['scroll-behavior'] = opt.nosm ? 'auto' : 'smooth';   // voor _emb versie
    rolElm.style.visibility = opt.noDash ? 'hidden' : 'visible';

    function errmsg (txt, line, col) {
        errtxt += txt + '\n';
    }

    function img_out (str) {
        if (str.indexOf ('<svg') != -1) {
            stfPos [nSvg] = Object.keys (stfys);
            stfys = {}
            nSvg += 1;
            if (xleft < xleftmin) xleftmin = xleft;
            if (xright > xrightmax) xrightmax = xright;
        }
        muziek += str;
    }

    function svgInfo (type, s1, s2, x, y, w, h) {
        if (type == 'note' || type == 'rest' || type == 'grace') {
            x = abc2svg.ax (x).toFixed (2);
            y = abc2svg.ay (y).toFixed (2);
            h = abc2svg.ah (h);
            ntsPos [s1] = [nSvg, x, y, w, h];
        }
        if (type == 'bar') {
            y = abc2svg.ay (y);
            h = abc2svg.ah (h);
            y = Math.round (y + h);
            stfys [y] = 1;
            xright = abc2svg.ax (x);
            xleft = abc2svg.ax (0);
        }
    }

    function getNote (event) {
        var p, isvg, x, y, w, h, xp, jsvg, i, ys, yp, t, v;
        var playing = get_playing ();
        event.stopPropagation ();
        jsvg = deSvgs.indexOf (this);
        if (!fplay || jsvg < 0) {
            playBack (0);
            dolayout (abctxt, abc_elm, 1);
            return;
        }
        x = event.clientX;           // position click relative to page
        x -= this.getBoundingClientRect ().left;    // positie linker rand (van this = klikelement = svg) t.o.v. de viewPort
        xp = x * gScale;
        if (xp < xleftmin || xp > xrightmax) { // click in the margin
            playBack (0);
            return;
        }
        if (!playing && abc_elm) playBack (1);    // abc_elm == null in xmlplay.js
        yp = (event.clientY - this.getBoundingClientRect ().top) * gScale;
        ys = stfPos [jsvg];
        for (i = 0; i < ys.length; i++) {
            if (ys [i] > yp) {                      // op staff i is geklikt
                curStaff = i;
                break;
            }
        }
        for (i = 0; i < ntsSeq.length; ++i) {
            p = ntsSeq [i].xy;
            if (!p) continue;       // invisible rest
            v = ntsSeq [i].vce
            if (gStaves [curStaff].indexOf (v) == -1) continue; // stem niet in balk curStaff
            isvg = p[0]; x = p[1]; y = p[2]; w = p[3]; h = p[4];
            if (isvg < jsvg) continue;
            if (xp < parseFloat (x) + w) {
                iSeq = i;
                t = ntsSeq [i].t
                isvgPrev.fill (-1); // invalidate all cursor line positions => force scroll
                while (ntsSeq [i] && ntsSeq [i].t == t) {
                    putMarkLoc (ntsSeq [i]);
                    i += 1
                }
                break;
            }
        }
    }

    if (!abctxt) return;

    var user = {
        'imagesize': 'width="100%"',
        'img_out': img_out,
        'errmsg': errmsg,
        'read_file': function (x) { return ''; },   // %%abc-include, unused
        'anno_start': svgInfo,
        'get_abcmodel': null
    }
    abc2svg = new Abc (user);
    abc2svg.tosvg ('abc2svg', abctxt);
    if (errtxt == '') errtxt = 'no error';
    logerr (errtxt.trim ());
	if (!muziek) return;

    abcElm.innerHTML = muziek;
    deSvgs = Array.prototype.slice.call (abcElm.getElementsByTagName ('svg'));
    deSvgs.forEach (function (svg, i) {     // vervang svg door de top graphic (door %%pagescale)
        var g = svg.querySelector ('.g');   // de titel svg is mogelijk niet geschaald wanneer
        deSvgGs [i] = g ? g: svg;           // %%pagescale onder de T: regel staat
    });
    setScale ();
    deSvgs.forEach (function (svg) {
        addUnlockListener (svg, 'click', getNote);
    });
    if (fplay) {
        isvgAligned = -1;   // de eerste keer altijd uitlijnen 
        iSeq = 0;       // nieuw stuk, of nieuw fragment in _emb-versie
        mkNtsSeq ();    // => putMarkLoc => alignSystem
    }
    document.addEventListener ('scrollend', eindRol); // eindRol is een statische functie => wordt maar één keer toegevoegd
}

function setScale () {
    if (deSvgs.length == 0) return;
    var i = deSvgs.length - 1;  // de titel is mogelijk niet geschaald, de rest wel
    var w_svg, w_vbx, m, scale, svg = deSvgs [i];
    var w_svg = svg.getBoundingClientRect ().width;     // width svg element in pixels
    try       { w_vbx = svg.viewBox.baseVal.width; }    // width svg element (vbx coors)
    catch (e) { w_vbx = w_svg; }                        // no viewbox
    m = (m = deSvgGs [i].transform) ? m.baseVal : [];   // scale factor top g-grafic
    scale = m.length ? m.getItem (0).matrix.a : 1;      // scale: svg-coors -> vbx-coors
    gScale = ((w_vbx / scale) / w_svg);                 // pixels -> svg-coors
}

function mkNtsSeq () {
    var curNoteTime  = iSeq > 0 && ntsSeq [iSeq] ? ntsSeq [iSeq].t : 0;
    var repcnt = 1, offset = 0, repstart = 0, reptime = 0, volta = 0, tvolta = 0, i, n;
    ntsSeq = [];    // schoonmaken voor emb-versie
    barTimes = {};  // idem, want wordt hier gevuld.
    for (i = 0; i < allNotes.length; ++i) {
        n = allNotes [i];
        if (n.bt && n.v == 0) {
            if (n.t in barTimes && n.bt [0] == ':') continue;  // herhaling maar 1 keer uitvoeren (bij herhaling in herhaling)
            if (repcnt == 1 && n.bt [0] == ':' && n.t > reptime) { i = repstart - 1; repcnt = 2; offset += n.t - reptime; continue; }
            if (repcnt == 2 && n.bt [0] == ':' && n.t > reptime) { repcnt = 1; }
            if (repcnt == 1 && n.bt [n.bt.length - 1] == ':') { repstart = i; reptime = n.t; }
            if (volta && (n.tx || n.bt != '|')) { volta = 0; offset -= n.t - tvolta; }
            if (repcnt == 2 && n.tx == '1') { volta = 1; tvolta = n.t }
        };
        if (volta) continue;
        if (n.bt) { barTimes [n.t] = 1; continue; } // maattijden zonder herhalingsoffset
        var ntpos = metRects ? n.ix : ntsPos [n.ix]
        ntsSeq.push ({ t: n.t + offset, xy: ntpos, ns: n.ns, vce: n.v, inv: n.inv, tmp: n.tmp });
    }
    iSeq = 0;
    for (; iSeq < ntsSeq.length; ++iSeq) {  // zet iSeq zo richt mogelijk bij laatste cursor positie
        n = ntsSeq [iSeq];
        if (n.t >= curNoteTime && !n.inv) break;    // de eerste zichtbare noot
    }
    if (iSeq == ntsSeq.length) iSeq -= 1;
    putMarkLoc (ntsSeq [iSeq]);
}

function rolRegel (e, isvg) {   // rol regel isvg tot aan de stippellijn
    var b, roltop, ds;
    b = deSvgGs [isvg].getBoundingClientRect ().top;    // top muziekregel t.o.v. de viewPort
    b += (stfPos [isvg][0] -  stfHgt [0]) / gScale;     // top boventste balk
    roltop = rolElm.getBoundingClientRect ().bottom;    // positie stippellijn
    ds = Math.round (b - roltop);                       // te rollen afstand
    if (ds != 0) e.scrollTop += ds;                     // scrolling e
}

function alignSystem (isvg) {
    var roltop;
    const rolt = (e) => e.clientHeight < e.scrollHeight
    if (isvg == isvgAligned) return
    isvgAligned = isvg;
    if (rolt (abcElm)) {    // alleen als abcElm kan rollen
        alignActive = 1;    // eindRol wordt altijd aangeroepen => alignActive = 0
        var a = abcElm.getBoundingClientRect ()
        var roltop = rolElm.getBoundingClientRect ().bottom;    // positie stippellijn
        var ds = Math.round (a.top - roltop) + 100;
        if (ds != 0 && rolt (document.scrollingElement)) {      // rol het document precies naar deze positie
            document.scrollingElement.scrollTop += ds;          // => eindRol ()
        } else {
            eindRol ();     // er was geen rol, het document was al op de goede positie
        }
    } else {
        rolRegel (document.scrollingElement, isvg);
    }
}

function eindRol () {               // einde van documentrol
    if (!alignActive) return        // als de gebruiker het document rolt
    rolRegel (abcElm, isvgAligned);
    alignActive = 0;
}

function putMarkLoc (n, align=1) {
    var p, isvg, x, y, w, h, mark, pn;
    if (metRects) { putMarkExt (n); return; }
    mark = rMarks [n.vce];
    p = n.xy;
    if (!p) {   // n.xy == undefined
        mark.setAttribute ('width', 0);
        mark.setAttribute ('height', 0);
        return;
    }
    isvg = p[0]; x = p[1]; y = p[2]; w = p[3]; h = p[4];
    if (n.inv) { w = 0; h = 0; }    // markeer geen onzichtbare rusten/noten
    if (align == 2) isvgPrev [n.vce] = -1;  // forceer een rol
    if (isvg != isvgPrev [n.vce]) {
        pn = mark.parentNode;
        if (pn) pn.removeChild (mark);
        pn = deSvgGs [isvg]
        pn.insertBefore (mark, pn.firstChild);
        isvgPrev [n.vce] = isvg;
        if (align > 0 && !n.inv) alignSystem (isvg);    // isvg soms ver weg bij onzichtbare noten ??
    }
    mark.setAttribute ('x', x);
    mark.setAttribute ('y', y);
    mark.setAttribute ('width', w);
    mark.setAttribute ('height', h);
}

function plaatsLoper (doeltijd) {
    var zoek = 1, lastnote;
    for (var i = 0; i < ntsSeq.length; ++i) {
        var nt = ntsSeq [i];
        if (nt.t > doeltijd) {
            putMarkLoc (lastnote, 2); // 1 keer expliciet aligneren
            break; // stop bij eerste noot na de doeltijd
        }
        putMarkLoc (nt, false);
        if (nt.t == doeltijd) {
            if (zoek) { iSeq = i; zoek = 0; }   // iSeq => eerst gevonden noot
            putMarkLoc (nt, false);
        }
        if (nt.xy) lastnote = nt;   // onthoud laatste zichtbare noot voor het scrollen
    }
}

function naarMaat (inc) {
    var tcur = ntsSeq [iSeq].ns [0].t;  // abc tijd zonder herhalingsoffset
    for (var i = iSeq; i < ntsSeq.length && i >= 0; i += inc) {
        var t = ntsSeq [i].ns [0].t;
        if (t != tcur && (t in barTimes || t == 0)) {   // t == 0 zit niet in barTimes ...
            plaatsLoper (ntsSeq [i].t);   // echte tijd met herhalingsoffset
            break;
        }
    }
}

function regelOmhoog (inc) {
    var svgcur, xcur, i, svg, x, dxmin = Infinity;
    for (i = iSeq; i < ntsSeq.length && i >= 0; i += inc) {
        if (!ntsSeq [i].xy) continue;   // noten/rusten die geen .xy hebben (meestal onzichtbare rust)
        if (ntsSeq [i].inv) continue;   // onzichtbare noten/rusten die wel een .xy hebben ...
        if (!xcur) { [svgcur, xcur] = ntsSeq [i].xy; continue; } // vertrekpunt
        [svg, x] = ntsSeq [i].xy;       // regelnummer, horizontale positie
        if (svg == svgcur + inc) {      // de regel erboven/eronder
            if (Math.abs (xcur - x) < dxmin) {  // zoek horizontaal dichtstbijzijnde noot
                dxmin = Math.abs (xcur - x);
                iSeq = i;
            }
        }
        if (inc == 1 && svg > svgcur + inc) break;  // stoppen na 1 regel
        if (inc == -1 && svg < svgcur + inc) break;
    }
    plaatsLoper (ntsSeq [iSeq].t);    // echte tijd met herhalingsoffset;
}

function markeer () {
    if (!audioCtx) { alert (alrtMsg2); return }
    var t0 = audioCtx.currentTime * 1000;
    var dt = 0, t1, tf;
    var tfac = 60000 / 384;
    while (dt == 0) {
        var nt = ntsSeq [iSeq];             // de huidige noot
        tf = tfac / (nt.tmp * tmpElm.value);    // abc tijd -> echte tijd in msec
        if (iSeq == ntsSeq.length - 1) {    // laatste noot
            iSeq = -1;                      // want straks +1
            dt = nt.ns[0].dur + 1000;       // 1 sec extra voor herhaling
        } else {
            t1 = ntsSeq [iSeq + 1].t;       // abc tijd van volgende noot
            dt = (t1 - nt.t) * tf;          // delta abc tijd * tf = delta echte tijd in msec
        }
        var b = nt.ns[0].orn.naam == 'arpeggio';
        var ard = b ? nt.ns[0].orn.ard * tf : 0;    // delay per noot voor arpeggio
        nt.ns.forEach (function (noot, i) { // speel accoord
            sLib.speel (t0 + i * ard, noot.inst, noot.mnum, noot.cnt, noot.dur, tf, nt.vce, noot.velo, noot.orn);
        });
        putMarkLoc (nt); 
        iSeq += 1;
    }
    var fout = t0 - gAccTime;   // echte tijd - ABC tijd
    gAccTime += dt; // echte starttijd + som ABC tijden
    clearTimeout (timer1);
    timer1 = setTimeout (markeer, fout < dt ? dt - fout : dt);  // probeer te corrigeren

}

function start_markeer (audioCtx_p, ntsel) {
    tmpElm = document.getElementById ('tempo') || { value: 1 };
    audioCtx = audioCtx_p;
    gAccTime = audioCtx.currentTime * 1000; // starttijd in millisecondes
    if (ntsel) {
        var [ib, ie] = ntsel.id.slice (1).split ('_').map (x => parseInt (x));
        var ibmin = 0, dmin = Infinity;
        for (var i = 0; i < ntsSeq.length; ++i) {
            var d = ntsSeq [i].xy - ib;
            if (d >= 0 && d < dmin) { dmin = d; ibmin = i; }
        }
        iSeq = ibmin;
    }
    markeer ();
}

function stop_markeer () {
    clearTimeout (timer1);
}

function mapPerc (abcIn) {
    var ls, i, x, r, r2, mapName, note, midi, mtab = {}, voiceMapNames = {};
    ls = abcIn.split ('\n');
    for (i = 0; i < ls.length; ++i) {
        x = ls [i];
        if (x.indexOf ('%%map') >= 0) {
            r = x.match(/%%map *(\S+) *(\S+).*midi=(\d+)/)
            r2 = x.match(/%%map *(\S+) /)
            if (r) {            // map name for percussion
                mapName = r[1]; note = r[2]; midi = r[3];
                mtab [mapName + note] = parseInt (midi);
            } else if (r2) {    // map name for tablature
                mapName = r2[1]
                voiceMapNames [mapName] = 1;
            }
        }
    }
    return [voiceMapNames, mtab];   // tablature map names, percussion map names
}

function perc2map (abcIn) {
    const percSvg = ['%%beginsvg\n<defs>',
        '<text id="x" x="-3" y="0">&#xe263;</text>',
        '<text id="x-" x="-3" y="0">&#xe263;</text>',
        '<text id="x+" x="-3" y="0">&#xe263;</text>',
        '<text id="normal" x="-3.7" y="0">&#xe0a3;</text>',
        '<text id="normal-" x="-3.7" y="0">&#xe0a3;</text>',
        '<text id="normal+" x="-3.7" y="0">&#xe0a4;</text>',
        '<g id="circle-x"><text x="-3" y="0">&#xe263;</text><circle r="4" class="stroke"></circle></g>',
        '<g id="circle-x-"><text x="-3" y="0">&#xe263;</text><circle r="4" class="stroke"></circle></g>',
        '<path id="triangle" d="m-4 -3.2l4 6.4 4 -6.4z" class="stroke" style="stroke-width:1.4"></path>',
        '<path id="triangle-" d="m-4 -3.2l4 6.4 4 -6.4z" class="stroke" style="stroke-width:1.4"></path>',
        '<path id="triangle+" d="m-4 -3.2l4 6.4 4 -6.4z" class="stroke" style="fill:#000"></path>',
        '<path id="square" d="m-3.5 3l0 -6.2 7.2 0 0 6.2z" class="stroke" style="stroke-width:1.4"></path>',
        '<path id="square-" d="m-3.5 3l0 -6.2 7.2 0 0 6.2z" class="stroke" style="stroke-width:1.4"></path>',
        '<path id="square+" d="m-3.5 3l0 -6.2 7.2 0 0 6.2z" class="stroke" style="fill:#000"></path>',
        '<path id="diamond" d="m0 -3l4.2 3.2 -4.2 3.2 -4.2 -3.2z" class="stroke" style="stroke-width:1.4"></path>',
        '<path id="diamond-" d="m0 -3l4.2 3.2 -4.2 3.2 -4.2 -3.2z" class="stroke" style="stroke-width:1.4"></path>',
        '<path id="diamond+" d="m0 -3l4.2 3.2 -4.2 3.2 -4.2 -3.2z" class="stroke" style="fill:#000"></path>',
        '</defs>\n%%endsvg'];
    var fillmap = {'diamond':1, 'triangle':1, 'square':1, 'normal':1};
    var abc = percSvg, ls, i, x, r, id='default', maps = {'default':[]}, dmaps = {'default':[]};
    ls = abcIn.split ('\n');
    for (i = 0; i < ls.length; ++i) {
        x = ls [i];
        if (x.indexOf ('I:percmap') >= 0) {
            x = x.split (/\s+/).map (x => x.trim ());
            if (x.length < 5) return abcIn; // dit is niet mijn I:percmap
            var kop = x[4];
            if (kop in fillmap) kop = kop + '+' + ',' + kop;
            x = '%%map perc'+id+ ' ' +x[1]+' print=' +x[2]+ ' midi=' +x[3]+ ' heads=' + kop;
            maps [id].push (x);
        }
        if (x.indexOf ('%%MIDI') >= 0) dmaps [id].push (x);
        if (x.indexOf ('V:') >= 0) {
            r = x.match (/V:\s*(\S+)/);
            if (r) {
                id = r[1];
            if (!(id in maps)) { maps [id] = []; dmaps [id] = []; }
            }
        }
    }
    var ids = Object.keys (maps).sort ();
    for (i = 0; i < ids.length; ++i) abc = abc.concat (maps [ids [i]]);
    id = 'default';
    for (i = 0; i < ls.length; ++i) {
        x = ls [i];
        if (x.indexOf ('I:percmap') >= 0) continue;
        if (x.indexOf ('%%MIDI') >= 0) continue;
        if (x.indexOf ('V:') >= 0 || x.indexOf ('K:') >= 0) {
            r = x.match (/V:\s*(\S+)/);
            if (r) id = r[1];
            abc.push (x);
        if (id in dmaps && dmaps [id].length) { abc = abc.concat (dmaps [id]); delete dmaps [id]; }
            if (x.indexOf ('perc') >= 0 && x.indexOf ('map=') == -1) x += ' map=perc';
            if (x.indexOf ('map=perc') >= 0 && maps [id].length > 0) abc.push ('%%voicemap perc' + id);
            if (x.indexOf ('map=off') >= 0) abc.push ('%%voicemap');
        }
        else abc.push (x);
    }
    return abc.join ('\n');
}

function schuifLijn (evt) {
    function schuift (evt) {
        rolElm.style.top = (evt.clientY - 15) + 'px';
    }
    function klaar (evt) {
        evt.stopPropagation (); // anders stopt playback (event listener van document)
        rolElm.removeEventListener ('pointermove', schuift);
        rolElm.removeEventListener ('pointerup', klaar);
        rolElm.removeEventListener ('pointerleave', klaar);
        rolElm.style.cursor = 'initial';
        var isvg = isvgAligned;
        isvgAligned = -1
        alignSystem (isvg);
    }
    rolElm.style.cursor = 'row-resize';
    rolElm.addEventListener ('pointermove', schuift);
    rolElm.addEventListener ('pointerup', klaar);
    rolElm.addEventListener ('pointerleave', klaar);
}

function addElms () {
    var stijl = document.createElement ('style')
    var x = '#rollijn  { position:fixed; height:30px; width:100%; z-index:1; '
    x += 'top: 30%; border-bottom: thin dashed black; touch-action: none; }\n'
    x += '#rollijn:hover { cursor: row-resize; background: rgba(0,255,0,0.3); }\n'
    x += '.dlog { display:none; background:lightblue; position:fixed; top: 50%; left: 50%; '
    x += 'width:60%; padding:10px; transform: translate(-50%,-50%); z-index:9; overflow: auto; }\n'
    stijl.innerHTML = x;
    document.head.appendChild (stijl);
    rolElm = document.createElement ('div')
    rolElm.id = 'rollijn'
    document.body.appendChild (rolElm);
    rolElm.addEventListener ('pointerdown', schuifLijn);
    var dlg = document.createElement ('div');
    dlg.id = 'comp';
    dlg.classList.add ('dlog');
    document.body.appendChild (dlg);
}

export { 
    doModel, stf2name, vce2stf, midiVol, midiPan, midiInstr, midiUsedArr,
    doLayout, mkNtsSeq, ntsSeq,
    start_markeer, stop_markeer, iSeq,
    putMarkLoc, naarMaat, regelOmhoog, setScale, addElms,
    mapPerc, perc2map
}
