//~ Revision: 159, Copyright (C) 2016-2025: Willem Vree, contributions Stéphane David.
//~ This program is free software; you can redistribute it and/or modify it under the terms of the
//~ GNU General Public License as published by the Free Software Foundation; either version 2 of
//~ the License, or (at your option) any later version.
//~ This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//~ without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//~ See the GNU General Public License for more details. <http://www.gnu.org/licenses/gpl.html>.

'use strict'
var xmlplay_VERSION = 159;

(function () {
    var opt = {
        speed: 1.0,     // initial value of the menu item: speed
        sf2url1: './',  // path to directory containing sound SF2 fonts
        sf2url2: '',    // fall back path
        instTab: {},    // { instrument number -> instrument name } for non standard instrument names
        midijsUrl1: './',       // path to directory containing sound MIDI-js fonts
        midijsUrl2: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/',
        instList: {},   // {voice number: instrument number} (override %%MIDI)
        transMap: {},   // stem nummer -> transpositie
        burak: 0        // ornamenten specifiek voor burak
    }
    var gAbcSave, gAbcTxt, allNotes, gBeats, gStaves, nVoices, scoreFnm;
    var iSeq = 0, iSeqStart, isPlaying = 0, timer1, gToSynth = 0, hasSmooth;
    var ntsSeq = [];
    var gTrans = [];    // playback transposition for each voice
    var barTimes = {};      // maattijden als herhalingen niet uitgevoerd worden
    var ntsPos = {};    // {abc_char_pos -> nSvg, x, y, w, h}
    var stfPos = [];    // [stfys for each svg]
    var deSvgs = [], deSvgGs = [];
    var twoSys;
    var topSpace = 500, gScale;
    var dottedHeight = 30;
    var curStaff = 0;
    var isvgPrev = [];  // svg index of each marker
    var isvgAligned = 0;
    var rMarks = [];    // a marker for each voice
    var audioCtx = null;
    var golven = [];
    var liggend = [];
    var midiLoaded = {};    // midi nums of already loaded MIDIjs waves
    var midiUsedArr = [];   // midi nums in score
    var notationHeight = 100;
    var fileURL = '';
    var drop_files = null;
    var stfHgt = [];
    var instSf2Loaded = {};
    var instArr = [];   // { note_name -> b64 encoded compressed audio } for each loaded SF2 instrument
    var mapTab = {};    // { map_name + ABC_note -> midi_number }
    var midiVol = [];   // volume for each voice from midi controller 7
    var midiPan = [];   // panning for each voice from midi controller 10
    var midiInstr = []; // instrument for each voice from midi program
    var vce2stf = {};   // voice id => staff number
    var stf2name = {};  // staff number => staff name
    var gTunings = {};  // string tuning per voice
    var gDiafret = {};  // diatonic fretting per voice (0 = chromatic, 1 = diatonic)
    var abcElm = null;  // contains the svg elements (score)
    var cmpDlg, errElm, abcfile, rolElm, fknElm, tmpElm, drpuse, drplbl, mbar, menu, playbk, playbtn;
    var alrtMsg2 = 'Your browser has no Web Audio API -> no playback.'
    var	inst_tb = [ "acoustic_grand_piano", "bright_acoustic_piano", "electric_grand_piano",
        "honkytonk_piano", "electric_piano_1", "electric_piano_2", "harpsichord", "clavinet", "celesta",
        "glockenspiel", "music_box", "vibraphone", "marimba", "xylophone", "tubular_bells", "dulcimer",
        "drawbar_organ", "percussive_organ", "rock_organ", "church_organ", "reed_organ", "accordion",
        "harmonica", "tango_accordion", "acoustic_guitar_nylon", "acoustic_guitar_steel",
        "electric_guitar_jazz", "electric_guitar_clean", "electric_guitar_muted", "overdriven_guitar",
        "distortion_guitar", "guitar_harmonics", "acoustic_bass", "electric_bass_finger", 
        "electric_bass_pick", "fretless_bass", "slap_bass_1", "slap_bass_2", "synth_bass_1",
        "synth_bass_2", "violin", "viola", "cello", "contrabass", "tremolo_strings", "pizzicato_strings",
        "orchestral_harp", "timpani", "string_ensemble_1", "string_ensemble_2", "synth_strings_1",
        "synth_strings_2", "choir_aahs", "voice_oohs", "synth_choir", "orchestra_hit", "trumpet",
        "trombone", "tuba", "muted_trumpet", "french_horn", "brass_section", "synth_brass_1",
        "synth_brass_2", "soprano_sax", "alto_sax", "tenor_sax", "baritone_sax", "oboe", "english_horn",
        "bassoon", "clarinet", "piccolo", "flute", "recorder", "pan_flute", "blown_bottle", "shakuhachi",
        "whistle", "ocarina", "lead_1_square", "lead_2_sawtooth", "lead_3_calliope", "lead_4_chiff",
        "lead_5_charang", "lead_6_voice", "lead_7_fifths", "lead_8_bass__lead", "pad_1_new_age",
        "pad_2_warm", "pad_3_polysynth", "pad_4_choir", "pad_5_bowed", "pad_6_metallic", "pad_7_halo",
        "pad_8_sweep", "fx_1_rain", "fx_2_soundtrack", "fx_3_crystal", "fx_4_atmosphere",
        "fx_5_brightness", "fx_6_goblins", "fx_7_echoes", "fx_8_scifi", "sitar", "banjo", "shamisen",
        "koto", "kalimba", "bagpipe", "fiddle", "shanai", "tinkle_bell", "agogo", "steel_drums",
        "woodblock", "taiko_drum", "melodic_tom", "synth_drum", "reverse_cymbal", "guitar_fret_noise",
        "breath_noise", "seashore", "bird_tweet", "telephone_ring", "helicopter", "applause","gunshot"]
    var gTempo = 120;
    var params = [];    // [instr][key] note parameters per instrument
    var rates = [];     // [instr][key] playback rates
    var withRT = 1;     // enable real time synthesis, otherwise pre-rendered waves (MIDIjs)
    var noPF = 0;       // do not translate xml page format
    var noLB = 0;       // do not translate xml line breaks
    var gCurMask = 0;   // cursor mask (0-255)
    const volCorJS = 0.5 / 32;  // volume scaling factor for midiJS
    const volCorSF = 0.5 / 60;  // idem for Sf2 (60 == volume of !p!)
    var hasPan = 1, hasLFO = 1, hasFlt = 1, hasVCF = 1; // web audio api support
    var gAccTime;       // som van de ABC tijden in millisecondes (plus de starttijd)
    var instMap;        // midi-instrument => midi-instrument voor dynamische klankverandering
    var debug = 0;      // print debug messages

const schuifregelaar = `<div class="schuif">
    <div class="rij">
        <div class="vol">
            <label>Vol_XXX</label>
            <input type="range" list="markers" min="0" max="127" step="1">
            <div>0</div>
        </div>
        <div>&nbsp;</div>
        <div class="pan">
            <label>Pan_XXX</label>
            <input type="range" list="markers" min="0" max="127" step="1">
            <div>0</div>
        </div>
    </div>
    <div class="instnum">Inst <input type=number value="22"></div>
</div>
`
const svg36 = ['%%beginsvg','<defs>',
'<text id="acc1_3" x="-1">&#xe261; <tspan x="-6" y="-4" style="font-size:14px">&#8593;</tspan></text>',
'<text id="acc2_3" x="-1">&#xe262; <tspan x="-5" y="14" style="font-size:14px">&#8595;</tspan></text>',
'<text id="acc4_3" x="-1">&#xe262; <tspan x="-5" y="-4" style="font-size:14px">&#8593;</tspan></text>',
'<text id="acc-4_3" x="-2">&#xe260; <tspan x="-8.2" y="9" style="font-size:16px">&#8595;</tspan></text>',
'<text id="acc-2_3" x="-1">&#xe260; <tspan x="-7.3" y="-1" style="font-size:16px">&#8593;</tspan></text>',
'<text id="acc-1_3" x="-1">&#xe261; <tspan x="-2" y="12" style="font-size:14px">&#8595;</tspan></text>',
'</defs>','%%endsvg'].join ('\n')

function logerr (s) { errElm.innerHTML += s + '\n'; }
function logcmp (s) { logerr (s); cmpDlg.innerHTML += s + '<br>'}
function loginst (s) { logerr (s); cmpDlg.innerHTML += '<div style="white-space: nowrap">' + s + '</div>'}

function readAbcOrXML (abctxt) {
    var xs = abctxt.slice (0, 4000);    // only look at the beginning of the file
    if (xs.indexOf ('X:') >= 0)      { dolayout (abctxt); return }
    if (xs.indexOf ('<?xml ') == -1) { alert ('not an xml file nor an abc file'); return }
    var p = new window.DOMParser ();
    var xmldata = p.parseFromString (abctxt, "text/xml")
    var options = { p:'f', t:1, u:0, v:3, m:2, mnum:0 };    // t==1 -> tab en perc naar %%map
    if (noPF) options.p = '';
    if (noLB) options.x = 1;
    if (opt.rbm) options.rbm = 1;
    var res = vertaal (xmldata, options);
    if (res[1]) logerr (res[1]);
    dolayout (res[0]);
}

function readLocalFile () {
    var f, freader = new FileReader ();
    freader.onload = function (e) { readAbcOrXML (freader.result); }
    if (drop_files) f = drop_files [0]
    else            f = fknElm.files [0];
    if (f) {
        scoreFnm = f.name.split ('.')[0];
        freader.readAsText (f);
    }
}

function readDbxFile (files) {
    errElm.innerHTML = '';    // clear error output area
    var url = files[0].link;
    scoreFnm = files[0].name.split ('.')[0];
    cmpDlg.style.display = 'block';
    logerr ('link: ' + url + '<br>');
    var request = new XMLHttpRequest ();
    request.open ('GET', url, true);
    request.onload = function () {
        logerr ('XHR ok');
        cmpDlg.style.display = 'none';
        readAbcOrXML (request.responseText);
    }
    request.onerror = function () { logcmp ('XHR failed'); }
    request.send();
}

function doDrop (e) {
    e.stopPropagation ();
    e.preventDefault ();
    drop_files = e.dataTransfer.files;
    this.classList.remove ('indrag');
    readLocalFile ();
}

function dolayout (abctxt) {
    function stringTunings (abcIn) {
        var ls, i, x, r, vce, bstep, boct, mnum, tuning = {}, vid, diafret = {};
        var steps = [18, 20, 22, 24, 26, 28];   // apit van iedere snaar
        ls = abcIn.split ('\n');
        for (i = 0; i < ls.length; ++i) {
            x = ls [i];
            if (x.indexOf ('strings') >= 0) {
                r = x.match (/V:\s*(\S+).*strings\s*=\s*(\S+)/);   // ?? voice optional with error msg
                if (r) {
                    vid = r[1];         // real voice id
                    tuning [vid] = {};  // { apit snaar -> midi number }
                    r[2].split (',').forEach (function (n, ix) {
                        bstep = n[0]
                        boct = parseInt (n[1]) * 12;
                        mnum = boct + [0,2,4,5,7,9,11]['CDEFGAB'.indexOf (bstep)] + 12  // + capo ??
                        tuning [vid] [steps [ix]] = mnum;
                    });
                    diafret [vid] = x.indexOf ('diafret') >= 0;
                }
            }
        }
        return [tuning, diafret];
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
    var percSvg = ['%%beginsvg\n<defs>',
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

    function perc2map (abcIn) {
        var fillmap = {'diamond':1, 'triangle':1, 'square':1, 'normal':1};
        var abc = percSvg, ls, i, x, r, id='default', maps = {'default':[]}, dmaps = {'default':[]};
        ls = abcIn.split ('\n');
        for (i = 0; i < ls.length; ++i) {
            x = ls [i];
            if (x.indexOf ('I:percmap') >= 0) {
                x = x.split (' ').map (function (x) { return x.trim (); });
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
    if (abctxt.indexOf ('I:percmap') >= 0) abctxt = perc2map (abctxt);
    var voiceMapNames;
    if (abctxt.indexOf ('%%map') >= 0) [voiceMapNames, mapTab] = mapPerc (abctxt);
    if (abctxt.includes ('temperamentequal')) abctxt = svg36 + '\n' + abctxt;
    if (abctxt.indexOf (' strings') >= 0) {
        var tns = stringTunings (abctxt);
        gTunings = tns [0];
        gDiafret = tns [1];
    }
    gAbcSave = abctxt;  // bewaar abc met wijzigingen
    var abctxtTemp = abctxt;
    for (var vmapnm in voiceMapNames) {     // disable the voicemaps for tablature
        var nm1 = '%%voicemap ' + vmapnm;   // to get correct fractional midi numbers
        var nm2 = nm1.replace ('%voicemap', '_________')
        abctxtTemp = abctxtTemp.replaceAll (nm1, nm2)
    }
    doModel (abctxtTemp);   // only disable maps during model parsing
    doLayout (abctxt);
    var ss = document.getElementById ('schuivers');
    ss.replaceChildren ();  // verwijder de oude schuifregelaars
    for (var i = 0; i < midiVol.length; ++i) {
        var stf = vce2stf [i], nm = stf2name [stf];
        var shtml = schuifregelaar.replaceAll ('XXX', i + '<br>' + (nm ? nm : stf));
        ss.insertAdjacentHTML ('beforeend', shtml);
    }
    var vols = Array.from (document.querySelectorAll ('.vol input'));
    vols.forEach ((v, i) => {
        v.value = midiVol [i];
        setMidiVol (v, i);
        v.addEventListener ('change', evt => { setMidiVol (v, i) });
    });
    var pans = Array.from (document.querySelectorAll ('.pan input'));
    pans.forEach ((v, i) => {
        v.value = midiPan [i];
        setMidiPan (v, i);
        v.addEventListener ('change', evt => { setMidiPan (v, i) });
    });
    var instnums = Array.from (document.querySelectorAll ('.instnum input'));
    instnums.forEach ((v, i) => {
        v.value = midiInstr [i];
        v.addEventListener ('change', evt => { setMidiInst (v, i) });
    });
    instMap = Array (256).fill (1).map ((x,i) => i) // instMap [i] => i
}

function doModel (abctxt) {
    var abc2svg;
    var errtxt = '';
    var BAR = 0, GRACE = 4, KEY = 5, METER = 6, NOTE = 8, REST = 10, TEMPO = 14, BLOCK = 16, BASE_LEN = 1536;
    var keySteps = [3,0,4,1,5,2,6];     // step values of the cycle of fifth
    var scaleSteps = [0,2,4,5,7,9,11];  // step values of the scale of C
    var swingOn = 0;    // swing aan voor kwartnoten
    gAbcTxt = abctxt;
    allNotes = [];
    gTrans = [];
    tmpElm.value = opt.speed;
    gTempo = 120;
    midiVol = [];       // volume for each voice from midi controller 7
    midiPan = [];       // panning for each voice from midi controller 10
    midiInstr = [];     // instrument for each voice from midi program
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
        function compute_ornament (has_orn, n, p, v) {
            var nootop = noot2mid (n, p + 1, v)
            var nootneer = noot2mid (n, p - 1, v)
            return { naam: has_orn, nop: nootop, nnr: nootneer }
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
                    noot = { t: ts.time, mnum: -1, dur: ts.dur };
                    noten.push (noot);
                    deNoten.push ({ t: ts.time, ix: ts.istart, v: ts.v, ns: noten, inv: ts.invis, tmp: gTempo });
                    break;
                case NOTE:
                    var instr = midiInstr [ts.v];   // from %%MIDI program instr
                    if (ts.p_v.clef.clef_type == 'p') instr += 128;  // percussion
                    var has_orn = checkDecos (ts);
                    var tijd = ts.time; 
                    var duur = ts.dur;
                    if (voorslag.ns) [tijd, duur] = voegVslg (voorslag, tijd, duur, deNoten);
                    for (i = 0; i < ts.notes.length; ++i) { // parse all notes (chords)
                        n = ts.notes [i];
                        p = n.pit + 19;             // C -> 35 == 5 * 7, global step
                        v = ts.v;                   // voice number 0..
                        vid = ts.p_v.id;            // voice ID
                        vol = vceVol [v] || 60;     // 60 == !p! if no volume
                        var ornmnt = has_orn ? compute_ornament (has_orn, n, p, v) : {};
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
                    voorslag = {};
                    break;
                case GRACE:
                    var noten = parseNotes (ts.extra, 'next');
                    voorslag.ns = noten;    // directe toekenning aan voorslag.ns werkt niet ?????
                    voorslag.accia = ts.sappo
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
        const ornaments = ['trill','lowermordent','uppermordent','//'];
        var acctab = {}, curKey = {}, tied = {}, voorslag = {};
        var accTrans = {'-2':-2, '-1':-1, 0:0, 1:1, 2:2, 3:0};
        var diamap = '0,1-,1,1+,2,3,3,4,4,5,6,6+,7,8-,8,8+,9,10,10,11,11,12,13,13+,14'.split (',')
        var dyntab = {'ppp':30, 'pp':45, 'p':60, 'mp':75, 'mf':90, 'f':105, 'ff':120, 'fff':127}
        var vceVol = [], vol;
        var mtr = voice_tb [0].meter.a_meter;
        gBeats = mtr.length ? parseInt (mtr [0].top) : 4;
        for (var v = 0; v < voice_tb.length; ++v) {
            var key = voice_tb [v].key;
            setKey (v, key);
            tied [v] = {};
        }
        var midiUsed = {};
        nVoices = voice_tb.length;
        gStaves = getStaves (voice_tb);
        allNotes = parseNotes (ts_p);
        midiUsedArr = Object.keys (midiUsed);   // global used in laadNoot
    }

    if (abctxt.indexOf ('temperamentequal 53') >= 0) edo53 = 1;
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
        var alpha = 1 << i & gCurMask ? '0' : ''
        var rMark = document.createElementNS ('http://www.w3.org/2000/svg','rect');
        rMark.setAttribute ('fill', kleur [i % kleur.length] + alpha);
        rMark.setAttribute ('fill-opacity', '0.5');
        rMark.setAttribute ('width', '0');  // omdat <rect> geen standaard HTML element is werkt rMark.width = 0 niet.
        rMarks.push (rMark);
        isvgPrev.push (-1);
    }
    laadNoot ()
}

function doLayout (abctxt) {
    var abc2svg;
    var muziek = '';
    var errtxt = '';
    var nSvg = 0;
    iSeq = 0;
    iSeqStart = 0;
    ntsPos = {};    // {abc_char_pos -> nSvg, x, y, w, h}
    stfPos = [];    // [stfys for each svg]
    var stfys = {}; // y coors of the bar lines in a staff
    var xleft, xright, xleftmin = 1000, xrightmax = 0;
    curStaff = 0;

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
        event.stopPropagation ();
        x = event.clientX;           // position click relative to page
        x -= this.getBoundingClientRect ().left;    // positie linker rand (van this = klikelement = svg) t.o.v. de viewPort
        xp = x * gScale;
        if (xp < xleftmin + 24 || xp > xrightmax) {  // click in the margin
            playBack ();
            return;
        }
        jsvg = deSvgs.indexOf (this);
        yp = (event.clientY - this.getBoundingClientRect ().top) * gScale;
        ys = stfPos [jsvg];
        for (i = 0; i < ys.length; i++) {
            if (ys [i] > yp) {                      // op staff i is geklikt
                curStaff = i;
                alignSystem (jsvg);
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
                iSeqStart = iSeq;   // zet ook de permanente startpositie
                t = ntsSeq [i].t
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

    abcElm.innerHTML = '<div id="leeg" style="height:'+ topSpace +'px">&nbsp;</div>';
    abcElm.innerHTML += muziek;
    abcElm.innerHTML += '<div id="leeg" style="height:'+ topSpace +'px">&nbsp;</div>';
    addUnlockListener (document.getElementById ('leeg'), 'click', playBack);
    deSvgs = Array.prototype.slice.call (abcElm.getElementsByTagName ('svg'));
    deSvgs.forEach (function (svg, i) {     // vervang svg door de top graphic (door %%pagescale)
        var g = svg.querySelector ('.g');   // de titel svg is mogelijk niet geschaald wanneer
        deSvgGs [i] = g ? g: svg;           // %%pagescale onder de T: regel staat
    });
    setScale ();
    deSvgs.forEach (function (svg) {
        if (twoSys) svg.style.display = 'none';   // want beide systemen worden in putMarkLoc aan gezet
        addUnlockListener (svg, 'click', getNote);
    });
    mkNtsSeq ();
}

function setScale () {
    if (deSvgs.length == 0) return;
    var i = deSvgs.length - 1;  // de titel is mogelijk niet geschaald, de rest wel
    var w_svg, w_vbx, m, scale, svg = deSvgs [i];
    var w_svg = svg.getBoundingClientRect ().width;     // width svg element in pixels
    try       { w_vbx = svg.viewBox.baseVal.width; }    // width svg element (vbx coors)
    catch (e) { w_vbx = w_svg; }                        // no viewbox
    m = (m = deSvgGs [i].transform) ? m.baseVal : [];   // scale factor top g-grafic
    scale = m.numberOfItems ? m.getItem (0).matrix.a : 1;   // scale: svg-coors -> vbx-coors
    gScale = ((w_vbx / scale) / w_svg);                 // pixels -> svg-coors
}

function alignSystem (isvg) {   // uitlijnen balken met de rollijn
    var animflag = isvg != undefined;   // alleen animatie in getNote en putMarkLoc
    if (isvg == undefined) isvg = isvgAligned;
    var t = rolElm.getBoundingClientRect ().top;
    var u = deSvgs [isvg].getBoundingClientRect ().top;
    var istf = curStaff;
    var y = (stfPos [isvg][istf] - stfHgt [istf]) / gScale;
    var newTop = Math.round (abcElm.scrollTop + u + y - dottedHeight - t);
    if (newTop != abcElm.scrollTop) {
        if (hasSmooth) abcElm.style ['scroll-behavior'] = animflag ? 'smooth' : 'auto';
        abcElm.scrollTop = newTop;
    }
    isvgAligned = isvg;
}

function lijn_shift (evt) {
    evt.preventDefault();
    var touchDev = evt.type == 'touchstart';
    var doel = rolElm;
    doel.style.cursor = 'row-resize';
    doel.classList.add ('spel');
    function evfa (evt) {
        var h = abcElm.getBoundingClientRect ().top;
        var y = touchDev ? evt.touches[0].clientY : evt.clientY;
        doel.style.top = y - dottedHeight / 2 + 'px';
        alignSystem ();
    }
    doel.addEventListener ('mousemove', evfa);
    doel.addEventListener ('touchmove', evfa);
    function evfb (evt) {
        doel.removeEventListener ('mousemove', evfa)
        doel.removeEventListener ('touchmove', evfa)
        doel.removeEventListener ('mouseup', evfb)
        doel.removeEventListener ('touchend', evfb)
        doel.removeEventListener ('mouseleave', evfb)
        doel.style.cursor = '';
        doel.classList.remove ('spel');
    }
    doel.addEventListener ('mouseup', evfb);
    doel.addEventListener ('touchend', evfb);
    doel.addEventListener ('mouseleave', evfb);
}

function putMarkLoc (n, align = true) {
    var p, isvg, x, y, w, h, mark, pn;
    mark = rMarks [n.vce];
    p = n.xy;
    if (!p) {   // n.xy == undefined
        mark.setAttribute ('width', 0);
        mark.setAttribute ('height', 0);
        return;
    }
    isvg = p[0]; x = p[1]; y = p[2]; w = p[3]; h = p[4];
    if (n.inv) { w = 0; h = 0; }    // markeer geen onzichtbare rusten/noten
    if (isvg != isvgPrev [n.vce]) {
        pn = mark.parentNode;
        if (pn) pn.removeChild (mark);
        pn = deSvgGs [isvg]
        pn.insertBefore (mark, pn.firstChild);
        isvgPrev [n.vce] = isvg;
        if (align) alignSystem (isvg);
    }
    mark.setAttribute ('x', x);
    mark.setAttribute ('y', y);
    mark.setAttribute ('width', w);
    mark.setAttribute ('height', h);
}

function mkNtsSeq () {
    var curNoteTime  = iSeq > 0 ? ntsSeq [iSeq].t : 0;
    ntsSeq = []; barTimes = {};
    var repcnt = 1, offset = 0, repstart = 0, reptime = 0, volta = 0, tvolta = 0, i, n;
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
        ntsSeq.push ({ t: n.t + offset, xy: ntsPos [n.ix], ns: n.ns, vce: n.v, inv: n.inv, tmp: n.tmp });
    }
    iSeq = 0;
    for (; iSeq < ntsSeq.length; ++iSeq) {  // zet iSeq zo richt mogelijk bij laatste cursor positie
        n = ntsSeq [iSeq];
        if (n.t >= curNoteTime && !n.inv) break;    // de eerste zichtbare noot
    }
    if (iSeq == ntsSeq.length) iSeq -= 1;
    putMarkLoc (ntsSeq [iSeq]);
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
        nt.ns.forEach (function (noot, i) { // speel accoord
            speel (t0, noot.inst, noot.mnum, noot.cnt, noot.dur, tf, nt.vce, noot.velo, noot.orn);
        });
        putMarkLoc (nt); 
        iSeq += 1;
    }
    var fout = t0 - gAccTime;   // echte tijd - ABC tijd
    gAccTime += dt; // echte starttijd + som ABC tijden
    clearTimeout (timer1);
    timer1 = setTimeout (markeer, fout < dt ? dt - fout : dt);  // probeer te corrigeren

}

function keyDown (e) {
    var key = e.key;
    if (document.activeElement == mbar) {   // mbar heeft de focus
        if (key == 'Enter' || key == ' ' || key == 'm') $('#mbar').click ();  // => menu actief
        return;
    }
    if (menu.style.display != 'none') {     // menu is actief
        if (key == 'Escape' || key == 'm') $('#mbar').click ();   // => menu verdwijnt
        return;
    }
    if (e.altKey || e.ctrlKey || e.shiftKey || key == 'Tab') return;  // browser shortcuts
    e.preventDefault ();
    switch (key) {
    case 'ArrowLeft': case 'Left': naarMaat (-1); break;
    case 'ArrowRight': case 'Right': naarMaat (1); break;
    case 'ArrowUp': case 'Up': regelOmhoog (-1); break;
    case 'ArrowDown': case 'Down': regelOmhoog (1); break;
    case 'm': $('#mbar').click (); break;
    case 't': cmpDlg.style.display = cmpDlg.style.display == 'none' ? 'block' : 'none'; break;
    case ' ': playBack (); break;
    }
}

function plaatsLoper (doeltijd) {
    var zoek = 1;
    for (var i = 0; i < ntsSeq.length; ++i) {
        var nt = ntsSeq [i];
        if (nt.t > doeltijd) break; // stop bij eerste noot na de doeltijd
        putMarkLoc (nt, false);     // niet aligneren anders teveel scollanimaties
        if (nt.t == doeltijd) {
            if (zoek) { iSeq = i; zoek = 0; }   // iSeq => eerst gevonden noot
            putMarkLoc (nt, false);
            if (nt.xy) alignSystem (nt.xy [0]); // 1 keer expliciet aligneren
        }
    }
}

function naarMaat (inc) {
    var tcur = ntsSeq [iSeq].ns [0].t;  // abc tijd zonder herhalingsoffset
    for (var i = iSeq; i < ntsSeq.length && i >= 0; i += inc) {
        var t = ntsSeq [i].ns [0].t;
        if (t != tcur && (t in barTimes || t == 0)) {   // t == 0 zit niet in barTimes ...
            plaatsLoper (ntsSeq [i].t); // echte tijd met herhalingsoffset
            break;
        }
    }
}

function regelOmhoog (inc) {
    var svgcur, xcur, i, svg, x, dxmin = Infinity;
    for (i = iSeq; i < ntsSeq.length && i >= 0; i += inc) {
        if (!ntsSeq [i].xy) continue;   // onzichtbare noten/rusten
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
    plaatsLoper (ntsSeq [iSeq].t); // echte tijd met herhalingsoffset;
}

function playBack () {
    if (!ntsSeq.length) return;
    isPlaying = 1 - isPlaying
    if (isPlaying) {
        playbtn.value = 'Stop';
        playbk.style.display = 'none';
        gAccTime = audioCtx.currentTime * 1000; // starttijd in millisecondes
        markeer ();
    } else {
        playbtn.value = 'Play';
        clearTimeout (timer1);
    }
}

function setTempo (inc) {   // is -0.1, 0.1
    var curval = 1 * tmpElm.value;
    tmpElm.value = curval + inc;
}

function speel (tijd, inst, noot, cent, dur, tf, vce, velo, orn) {
    if (noot == -1) return; // een rust
    if (opt.burak && orn.naam == '//') orn.naam = '//burak'
    switch (orn.naam) {
    case 'lowermordent': case 'uppermordent':
        var [mn_nr, cent_nr] = orn.naam == 'lowermordent' ? orn.nnr : orn.nop;
        dur = dur * tf;
        var d = dur / 4;
        if (d > 100) d = 100;
        speelhulp (tijd,       inst, noot,  cent,    d, vce, velo);
        speelhulp (tijd +   d, inst, mn_nr, cent_nr, d, vce, velo);
        speelhulp (tijd + 2*d, inst, noot,  cent,    dur - 2*d, vce, velo);
        break;
    case '//':
        dur = dur * tf;
        var d = dur / 4;
        speelhulp (tijd,       inst, noot, cent, d, vce, velo);
        speelhulp (tijd +   d, inst, noot, cent, d, vce, velo);
        speelhulp (tijd + 2*d, inst, noot, cent, d, vce, velo);
        speelhulp (tijd + 3*d, inst, noot, cent, d, vce, velo);
        break;
    case '//burak': orn.nop = [noot, cent]; // herhaal snel
    case 'trill': 
        dur = dur * tf;
        var [mn_nr, cent_nr] = orn.nop;
        var t = tijd;
        while (t < tijd + dur) {
            speelhulp (t, inst, noot, cent, 100, vce, velo);
            t += 100;
            speelhulp (t, inst, mn_nr, cent_nr, 100, vce, velo);
            t += 100;
        }
        break;
    default:
        if (noot.dur <= 192) tf *= 1.3  // legato effect voor <= 1/8
        else  tf *= 1.1                 // minder voor > 1/8
        speelhulp (tijd, inst, noot, cent, dur * tf, vce, velo)
    }
}

function speelhulp (tijd, inst, noot, cent, dur, vce, velo) { // tijd en duur in millisecs
    inst = instMap  [inst];         // instrument uit het menu of met URL-parameter
    noot += opt.transMap [vce] || 0;    // transpositie per stem met URL-parameter
    if (inst in instSf2Loaded && withRT) {
        opneer (inst, noot, cent, tijd / 1000, (dur - 1) / 1000, vce, velo);  // msec -> sec
    } else if (inst in instArr){
        var midiMsg = [0x90, inst * 128 + noot, velo];
        zend (midiMsg, tijd, vce);
        midiMsg [2] = 0;
        zend (midiMsg, tijd + dur - 1, vce);
    }
}

function zend (midiMsg, tijd, vce) {
    if (gToSynth == 0) return;
    var mtype = midiMsg [0] & 0xf0,
        velo = midiMsg [2],
        midiNum = midiMsg [1];
    tijd /= 1000;   // millisec -> sec
    if (mtype == 0x80) op (midiNum, tijd);
    if (mtype == 0x90) {
        if (velo > 0) neer (midiNum, velo, tijd, vce);
        else op (midiNum, tijd);
    }
}

function neer (midiNum, velo, time, vce) {
    var vceVol = midiVol [vce] / 127;
    var vcePan = (midiPan [vce] - 64) / 64, panNode;
    var source = audioCtx.createBufferSource ();
    source.buffer = golven [midiNum];
    var gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime (0.00001, time);   // begin bij -100 dB
    var vol = velo * vceVol * volCorJS;
    if (vol == 0) vol = 0.00001;    // stem kan volume 0 hebben.
    gainNode.gain.exponentialRampToValueAtTime (vol, time + 0.001);
    if (hasPan) {
        panNode = audioCtx.createStereoPanner();
        panNode.pan.value = vcePan;
    }
    source.connect (panNode || gainNode);    // we doen de pan node voor de gain node!!
    if (panNode) panNode.connect (gainNode); // anders werkt de gain niet in FF
    gainNode.connect (audioCtx.destination); // verbind source met de sound kaart
    source.start (time);
    liggend [midiNum] = [source, gainNode, vol];
}

function op (midiNum, time) {
    var x = liggend [midiNum], source = x[0], g = x[1], velo = x[2];
    if (source) {
        g.gain.setValueAtTime (velo, time); // begin release at end of note
        g.gain.exponentialRampToValueAtTime (0.00001, time + 0.1); // -100 dB
        source.stop (time + 0.1);
        liggend [midiNum] = undefined;
    }
}

function opneer (instr, key, cent, t, dur, vce, velo) {
    var g, st, g1, g2, g3, lfo, g4, g5, panNode, vol;
    var th, td, decdur, suslev, fac, tend;
    var parm = params [instr][key];
    if (!parm) return;    // key does not exist
    var o = audioCtx.createBufferSource ();
    var wf = parm.useflt; // met filter
    var wl = parm.uselfo; // met LFO
    var we = parm.useenv; // met modulator envelope
    var vceVol = midiVol [vce] / 127;
    var vcePan = (midiPan [vce] - 64) / 64;

    o.buffer = parm.buffer
    if (parm.loopStart) {
        o.loop = true;
        o.loopStart = parm.loopStart;
        o.loopEnd = parm.loopEnd;
    }
    o.playbackRate.value = rates [instr][key];
    o.detune.value = cent;

    if (wl) {   // tremolo en/of vibrato
        lfo = audioCtx.createOscillator ();
        lfo.frequency.value = parm.lfofreq;
        g1 = audioCtx.createGain ();
        g1.gain.value = parm.lfo2vol;   // diepte tremolo
        lfo.connect (g1);               // output g1 is sinus tussen -lfo2vol en lfo2vol
        g2 = audioCtx.createGain ();
        g2.gain.value = 1.0;            // meerdere value inputs worden opgeteld
        g1.connect (g2.gain);           // g2.gain varieert tussen 1-lfo2vol en 1+lfo2vol

        g3 = audioCtx.createGain ();
        g3.gain.value = parm.lfo2ptc;   // cents, diepte vibrato
        lfo.connect (g3);
        g3.connect (o.detune);
    }

    if (wf) {
        var f = audioCtx.createBiquadFilter ();
        f.type = 'lowpass'
        f.frequency.value = parm.filter;
    }

    if (we) {
        vol = 1.0
        g4 = audioCtx.createGain();
        g4.gain.setValueAtTime (0, t);  // mod env is lineair
        g4.gain.linearRampToValueAtTime (vol, t + parm.envatt);
        th = parm.envhld; td = parm.envdec; decdur = 0;
        if (dur > th) {                             // decay phase needed
            g4.gain.setValueAtTime (vol, t + th);   // starting at end hold phase
            if (dur < td) {                         // partial decay phase
                decdur = dur - th                   // duration of decay phase
                suslev = parm.envsus * (decdur / (td - th));  // partial gain decrease
            } else {                                // full decay phase
                decdur = td - th
                suslev = parm.envsus                // full gain decrease (until sustain level)
            }
            vol = suslev * vol;                     // gain at end of decay phase
            g4.gain.linearRampToValueAtTime (vol, t + th + decdur); // until end time of decay phase
        }
        g4.gain.setValueAtTime (vol, t + dur);      // begin release at end of note
        fac = vol;                                  // still to go relative to 100% change
        tend = t + dur + fac * parm.envrel;         // end of release phase
        g4.gain.linearRampToValueAtTime (0.0, tend); // 0 at the end

        g5 = audioCtx.createConstantSource ();
        g5.offset.value = parm.env2flt;
        g5.connect (g4);
        g4.connect (f.detune);
    }

    if (hasPan) {
        panNode = audioCtx.createStereoPanner()
        panNode.pan.value = vcePan;
    }

    vol = velo * vceVol * parm.atten * volCorSF;
    if (vol == 0) vol = 0.00001;                // -100 dB is zero volume
    g = audioCtx.createGain();
    g.gain.setValueAtTime (0.00001, t);         // -100 dB is zero volume
    g.gain.exponentialRampToValueAtTime (vol, t + parm.attack);

    th = parm.hold; td = parm.decay; decdur = 0;
    if (dur > th) {                             // decay phase needed
        g.gain.setValueAtTime (vol, t + th);    // starting at end hold phase
        if (dur < td) {                         // partial decay phase
            decdur = dur - th                   // duration of decay phase
            suslev = Math.pow (10, Math.log10 (parm.sustain) * (decdur / (td - th)));  // partial gain decrease (linear ratio in dB)
        } else {                                // full decay phase
            decdur = td - th
            suslev = parm.sustain               // full gain decrease (until sustain level)
        }
        vol = suslev * vol;                     // gain at end of decay phase
        g.gain.exponentialRampToValueAtTime (vol, t + th + decdur); // until end time of decay phase
    }
    g.gain.setValueAtTime (vol, t + dur);       // begin release at end of note

    fac = (100 + 20 * Math.log10 (vol)) / 100;  // still to go relative to 100dB change
    tend = t + dur + fac * parm.release;        // end of release phase
    g.gain.exponentialRampToValueAtTime (0.00001, tend); // -100 dB

    if (wf) {   o.connect (f); f.connect (panNode || g); }
    else        o.connect (panNode || g);       // we doen de pan node voor de gain node!!
    if (panNode) panNode.connect (g);           // anders werkt de gain niet in FF
    if (wl) {   g.connect (g2); g2.connect (audioCtx.destination); }
    else        g.connect (audioCtx.destination);

    o.start (t);
    if (wl) lfo.start (t + parm.lfodel);
    if (we) g5.start (t);
    o.stop (tend);
    if (wl) lfo.stop (tend);
    if (we) g5.stop (tend);
}

function decode (xs) {
    return new Promise (function (resolve, reject) {
        var bstr = atob (xs);           // decode base64 to binary string
        var ab = new ArrayBuffer (bstr.length);
        var bs = new Uint8Array (ab);   // write as bytes
        for (var i = 0; i < bstr.length; i++)
            bs [i] = bstr.charCodeAt (i);
        audioCtx.decodeAudioData (ab, function (buffer) {
            resolve (buffer);           // buffer = AudioBuffer
        }, function (error) {
            reject ('error dedoding audio sample');
        });
    });
}

async function inst_create (instr) {
    rates [instr] = [];
    params[instr] = [];
    for (var i = 0; i < instData.length; ++i) {
        var gen, parm, sample, scale, tune, cd;
        gen = instData [i];
        if (!gen) continue;    // sample wordt overgeslagen?
        parm = {
            attack:  gen.attack,
            hold:    gen.hold,
            decay:   gen.decay,
            sustain: gen.sustain,
            release: gen.release,
            atten:   gen.atten,
            filter:  gen.filter,
            lfodel:  gen.lfodel,
            lfofreq: gen.lfofreq,
            lfo2ptc: gen.lfo2ptc,
            lfo2vol: gen.lfo2vol,
            envatt:  gen.envatt,
            envhld:  gen.envhld,
            envdec:  gen.envdec,
            envsus:  gen.envsus,
            envrel:  gen.envrel,
            env2flt: gen.env2flt,
            uselfo: hasLFO && gen.lfofreq > 0.008 && (gen.lfo2ptc != 0 || gen.lfo2vol != 0), // LFO needed (vibrato or tremolo)
            useflt: hasFlt && gen.filter < 16000,                       // lowpass filter needed
            useenv: hasVCF && gen.filter < 16000 && gen.env2flt != 0,   // modulator envelope needed
        }
        if (gen.loopStart) {
            parm.loopStart = gen.loopStart;
            parm.loopEnd   = gen.loopEnd;
        }
        scale = gen.scale;
        tune =  gen.tune;
        for (var j = gen.keyRangeLo; j <= gen.keyRangeHi; j++) {
            rates [instr][j] = Math.pow (Math.pow (2, 1 / 12), (j + tune) * scale);
            params[instr][j] = parm;
        }
        try {
            parm.buffer = await decode (gen.sample) // b64 encoded binary string -> AudioBuffer
        } catch (err) {
            logcmp (err);
            throw err;   // -> uitzondering in laadSF2noot => over naar MIDI-js
        }
    }
}

function laadJSfont (inst, url) {
    return new Promise (function (resolve, reject) {
        var elm = document.createElement ('script');
        elm.src = url;
        elm.onload = function () {
            resolve ('ok');
            document.head.removeChild (elm);
        };
        elm.onerror = function (err) {
            reject ('could not load instrument ' + inst);
        };
        document.head.appendChild (elm);
    });
}

async function laadNoot () {
    cmpDlg.style.display = 'block';
    cmpDlg.innerHTML = withRT ? 'Loading SF2 fonts<br>' : 'Loading MIDI-js fonts<br>';
    var urls = [{url: opt.sf2url1, metRT: 1}, {url: opt.sf2url2, metRT: 1},
                {url: opt.midijsUrl1, metRT: 0}, {url: opt.midijsUrl2, metRT: 0}]
    if (!withRT) urls = urls.slice (2);
    for (var x of urls) {
        try {
            await laadNoot2 (x.url, x.metRT)
            cmpDlg.style.display = 'none';
            logerr ('fonts geladen')
            return;
        } catch (err) {
            cmpDlg.innerHTML += err + '<br>'
            logerr (err);
        }
    }
    logcmp (' ... give up');
}

async function laadNoot2 (fonturl, metRT) {
    async function laadSF2Arr (instarr, pf) {
        for (var ix = 0; ix < instarr.length; ix++) {
            var inst = instarr [ix];
            if (inst in instSf2Loaded) continue;
            loginst (ix + ' loading instrument: ' + inst + (pf ? ' from: ' + pf : ''));
            var url = pf + 'instr' + inst + 'mp3.js';
            await laadJSfont (inst, url)    // => instData
            await inst_create (inst)
            instSf2Loaded [inst] = 1;
        }
    }
    async function laadMidiJsArr (instarr, pf) {
        for (var ix = 0; ix < instarr.length; ++ix) {
            var inst = instarr [ix];
            if (inst in instArr) continue;
            loginst (ix + ' loading instrument: ' + inst + ' from: ' + pf + '...');
            var instNm = inst in opt.instTab ? opt.instTab [inst] : inst_tb [inst]; // standard GM name;
            var url = pf + instNm + '-mp3.js';
            await laadJSfont (inst, url)
            instArr [inst] = MIDI.Soundfont [instNm];
        }
    }
    async function decodeMidiNums (midiNums) {
        for (var ix = 0; ix < midiNums.length; ++ix) {            
            var insmid = midiNums [ix];
            var inst = insmid >> 7;
            var ixm  = insmid % 128;
            var notes = 'C Db D Eb E F Gb G Ab A Bb B'.split (' ');
            var noot = notes [ixm % 12]
            var oct = Math.floor (ixm / 12) - 1;
            var xs = instArr [inst] [noot + oct].split (',')[1];
            var buffer = await decode (xs)
            golven [insmid] = buffer;
            cmpDlg.innerHTML += ', ' + inst + ':' + ixm;
            midiLoaded [insmid] = 1; // onthoud dat de noot geladen is
        }
        gToSynth = 1;
        loginst ('notes decoded')
    }
    var instrs = {};
    withRT = metRT
    midiUsedArr.forEach ((mnum) => { instrs [mnum >> 7] = 1; });
    if (withRT) {   // load SF2 fonts
            await laadSF2Arr (Object.keys (instrs), fonturl);
    } else {        // load MIDI-js fonts
        document.getElementById ('midijs').checked = 'true'
        var midiNums = midiUsedArr.filter (function (m) { return !(m in midiLoaded); });
        await laadMidiJsArr (Object.keys (instrs), fonturl)
        cmpDlg.innerHTML += 'decode notes:'
        await decodeMidiNums (midiNums);   // only decode samples of notes used in the score
    }
}

async function getPreload (xmlfnm, p_html, p_url, verder) {
    var xs = xmlfnm.match (/(.*\/)?([^/]*)$/);  // => [hele uitdrukking, pad, bestand]
    var pad = './' + (xs [1] ? xs [1] : '');    // relatieve pad naar parameter file t.o.v. plaats xmlplay.html
    var waitElm = document.getElementById ('wait');
    waitElm.style.display = 'block';
    try {
        var mod = await import (pad + 'parms.js')
        logerr ('parms.js loaded');
        doParms (p_html, p_url, mod.parms)
    } catch (err) {
        if (err.name == 'TypeError') logerr ('no parms.js present');
        else logerr ('Error in parms.js: ' + err.message);
        doParms (p_html, p_url, {});
    }
    try {
        var res = await fetch (xmlfnm)
        var xmltxt = await res.text ();
        logerr ('preload ok');
        readAbcOrXML (xmltxt);
        playbk.style.display = 'block';
        waitElm.style.display = 'none';
    } catch (err) {
        waitElm.innerHTML += '\npreload failed';
        throw (err)
    }
}

function doParms (p_html, p_url, p_mod) {
    var p = {};
    Object.assign (p, p_html, p_mod, p_url);    // in volgorde van prioriteit
    if (p.topSpace != undefined) topSpace = p.topSpace;
    if (p.notationHeight != undefined) notationHeight = p.notationHeight;
    if (p.fileURL != undefined) preload = p.fileURL;
    if (p.gTempo != undefined) gTempo = p.gTempo;
    if (p.speed != undefined) opt.speed = p.speed;
    if (p.noCur != undefined) gCurMask = p.noCur;
    if (p.noDash != undefined) rolElm.style.visibility = 'hidden';
    if (p.noSave != undefined) document.getElementById ('savlbl').style.display = 'none';
    if (p.noMenu != undefined) document.getElementById ('mbar').style.display = 'none';
    if (p.noErr != undefined)  { errElm.style.display = 'none'; errElm.style.height = '0px'; };
    if (p.noPF != undefined) noPF = 1;
    if (p.noLB != undefined) noLB = 1;
    if (p.noRT != undefined) withRT = !p.noRT;
    if (p.rbm != undefined) opt.rbm = p.rbm;
    if (p.burak != undefined) opt.burak = p.burak;
    if (p.instTab != undefined) opt.instTab = p.instTab;
    if (p.sf2url1 != undefined) opt.sf2url1 = p.sf2url1;
    if (p.sf2url2 != undefined) opt.sf2url2 = p.sf2url2;
    if (p.midijsUrl1 != undefined) opt.midijsUrl1 = p.midijsUrl1;
    if (p.midijsUrl2 != undefined) opt.midijsUrl2 = p.midijsUrl2;
    if (p.inst != undefined) {
        for (var t of p.inst) {
            if (t.length == 2) t.push (0)
            var [vnum, instnum, transval] = t
            opt.instList [vnum] = 1 * instnum;
            opt.transMap [vnum] = 1 * transval;
        }
    }
    if (p.deb != undefined) debug = 1;
}

async function parsePreload () {  // => getPreload => doParms => verder
    var parstr, xmlfnm = '', preload = '', ps, i, xs, prm, p, r, p_url = {};
    errElm.innerHTML = '';
    parstr = window.location.href.replace ('?dl=0','').split ('?'); // look for parameters in the url;
    if (parstr.length > 1) {
        ps = parstr [1].split ('&');
        for (i = 0; i < ps.length; i++) {
            p = ps [i].replace (/d:(\w{15}\/[^.]+\.)/, 'https://dl.dropboxusercontent.com/s/$1');
            if (p == 'noErr') p_url.noErr = 1;
            else if (p == 'noMenu') p_url.noMenu = 1;
            else if (p == 'noSave') p_url.noSave = 1;
            else if (p == 'noDash') p_url.noDash = 1;
            else if (p == 'noRT') p_url.noRT = 1;     // no realtime sf2, use pre-rendered MIDIjs
            else if (p == 'noPF') p_url.noPF = 1;     // do not translate xml page format
            else if (p == 'noLB') p_url.noLB = 1;     // do not translate xml line breaks
            else if (r = p.match (/noCur=([\da-fA-F]{2})/)) p_url.noCur = parseInt (r [1], 16);
            else if (p == 'nosm') hasSmooth = false;
            else if (p == 'ios') { hasLFO = 0; hasFlt = 0; hasVCF = 0; hasPan = 0; hasSmooth = 0; }
            else if (r = p.match (/sf2=(\w+)/)) p_url.sf2url2 = r [1] + '/';
            else if (r = p.match (/speed=([\d.]+)/)) p_url.speed = parseFloat (r [1]);
            else if (r = p.match (/inst=([,-\d:]*)/)) p_url.inst = r[1].split (',').map (x => x.split (':'));
            else if (p == 'deb') p_url.deb = 1;
            else if (p == 'rbm') p_url.rbm = 1;
            else if (p == 'burak') { p_url.rbm = 1; p_url.burak = 1; }
            else preload = p;
        }
    };
    prm = document.getElementById ('parms');
    if (prm) prm.style.display = 'none';
    var p_html = prm ? JSON.parse (prm.innerHTML) : {} ;

    if (/(\.xml$)|(\.abc$)/.test (preload)) { xmlfnm = preload; preload = ''; }
    if (xmlfnm) await getPreload (xmlfnm, p_html, p_url);
    else doParms (p_html, p_url, {});
}

function resizeNotation () {
    var bh = document.documentElement.clientHeight;
    var eh = errElm.clientHeight;
    eh = Math.round (100 * eh / bh);
    abcElm.style.height = (notationHeight - eh) + '%';
}

function saveLayout () {
    var abc2svg, muziek = '', errtxt = '';

    function errmsg (txt, line, col) {
        errtxt += txt + '\n';
    }

    function img_out (str) {
        muziek += str;
    }

    if (!gAbcSave) return;
    var user = {
        'imagesize': 'width="100%"',
        'img_out': img_out,
        'errmsg': errmsg,
        'read_file': null,
        'anno_start': null,
        'get_abcmodel': null
    }
    abc2svg = new Abc (user);
    abc2svg.tosvg ('abc2svg', gAbcSave);
    if (errtxt == '') errtxt = 'no error';
    logerr (errtxt.trim ());
	if (!muziek) return;

    var rs = Array.from (document.styleSheets[1].rules);    // CSS-stijlen die de SVG's nodig hebben
    var defs = rs.map (x => x.cssText);                     // de stijlregels als tekst voor <style> declaratie
    var res = '<html><meta charset="utf-8"><style>\n';
    res += defs.join ('\n');                                // de complete <style></style> inhoud voor de SVG's
    res += '\n</style>\n<div>\n' + muziek + '\n</div></html>\n';
    var fnm = scoreFnm + '.html';
    try {
        var a = document.createElement ('a');
        a.href = URL.createObjectURL (new Blob ([res]));    // tekstreeks => blob => blob-URL
        a.download = fnm;
        a.text = "Save HTML file"
        document.getElementById ('saveDiv').appendChild (a); // append to a dummy invisible div
        a.click (); // only seems to work if a is appended somewhere in the body
    } catch (err) {
        document.open ("text/html");    // clears the whole document and opens a new one
        document.write (res);
        document.close ();
        setTimeout (() => alert ('you can save this page with "save page as" in the browser file menu'), 100);
    }
}

function addUnlockListener (elm, type, handler) {
    function unlockAudio (evt){
        elm.removeEventListener ('mousedown', unlockAudio);
        elm.removeEventListener ('touchend', unlockAudio);
        console.log ('event listeners removed from ' + elm.nodeName + '#' + elm.id);
        if (audioCtx && audioCtx.state == 'suspended') {
            audioCtx.resume ().then (function () {
                console.log ('resuming audioContext');
            });
        }
    }
    elm.addEventListener ('mousedown', unlockAudio);
    elm.addEventListener ('touchend', unlockAudio);
    elm.addEventListener (type, handler);
}

function dropuse () {
    function grey (b) { drpuse.checked = !b; drpuse.disabled = b; drplbl.style.color = b ? '#aaa' : '#000';}
    if (typeof (Dropbox) == 'undefined') {
        grey (true);
        var elm = document.createElement ('script');
        elm.src = 'https://www.dropbox.com/static/api/2/dropins.js';
        elm.onload = function () {
            grey (false);
            Dropbox.init ({appKey: 'ckknarypgq10318'});
            var dknp = Dropbox.createChooseButton ({
                success: readDbxFile,
                cancel: function() {}, linkType: "direct", multiselect: false,
                extensions: ['.xml', '.abc']
            });
            abcfile.append (dknp);
            dropuse ();
        };
        elm.onerror = function () { logerr ('loading dropbox API failed'); };
        document.head.appendChild (elm);
    } else {
        document.querySelector ('.dropbox-dropin-btn').style.display = drpuse.checked ? 'inline-block' : 'none';
        fknElm.style.display = drpuse.checked ? 'none' : 'inline-block';
    }
}

function setFullscreen () {
    var e = document.body;
    var fscrAan = e.requestFullscreen || e.mozRequestFullScreen || e.webkitRequestFullscreen;
    var fscrUit = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen;
    if (!fscrAan || !fscrUit) return;
    if ($('#fscr').prop ('checked')) fscrAan.call (e);
    else fscrUit.call (document);
}

function setMidiVol (v, i) {
    midiVol [i] = 1 * v.value;
    v.parentElement.querySelector ('div').innerHTML = v.value;
}

function setMidiPan (v, i) {
    midiPan [i] = 1 * v.value;
    v.parentElement.querySelector ('div').innerHTML = v.value;
}

function setMidiInst (v, i) {
    const abcInst = midiInstr [i];  // instrument van stem i uit ABC file
    const inst = 1 * v.value;   // nieuw instrument
    instMap [abcInst] = inst;   // verander de instrument afbeelding
    midiUsedArr.push (60 + (inst << 7));    // C5 van nieuw instrument inst
    laadNoot ();    // laad nieuw instrument inst
}

document.addEventListener ('DOMContentLoaded', async function () {
    cmpDlg = document.getElementById ('comp');
    abcElm = document.getElementById ('notation');
    errElm = document.getElementById ('err');
    rolElm = document.getElementById ('rollijn');
    abcfile = document.getElementById ('abcfile');
    fknElm = document.getElementById ('fknp');
    tmpElm = document.getElementById ('tempo');
    playbk = document.getElementById ('playbk');
    playbtn = document.getElementById ('play');
    addUnlockListener (playbtn, 'click', playBack);
    addUnlockListener (playbk, 'click', playBack);
    fknElm.addEventListener ('change', readLocalFile);
    document.getElementById ('save').addEventListener ('click', saveLayout);
    rolElm.addEventListener ('mousedown', lijn_shift);
    rolElm.addEventListener ('touchstart', lijn_shift);
    window.addEventListener ('resize', function () {
        setScale ();
        resizeNotation ();
        alignSystem ();
    });
    // drag drop
    abcElm.addEventListener ('drop', doDrop);
    abcElm.addEventListener ('dragover', function (e) {   // this handler makes the element accept drops and generate drop-events
        e.stopPropagation ();
        e.preventDefault ();                        // the preventDefault is obligatory for drag/drop!
        e.dataTransfer.dropEffect = 'copy';         // Explicitly show this is a copy.
    });
    abcElm.addEventListener ('dragenter', function () { this.classList.add ('indrag'); });
    abcElm.addEventListener ('dragleave', function () { this.classList.remove ('indrag'); });
    // dropbox
    drpuse = document.getElementById ('drpuse');
    drpuse.checked = false;
    drpuse.addEventListener ('click', dropuse);
    drplbl = document.getElementById ('drplbl');
    // menu
    mbar = document.getElementById ('mbar');
    menu = document.getElementById ('menu');
    menu.style.display = 'none';
    mbar.addEventListener ('click', function (ev) {
        ev.stopPropagation ();
        var hidden = menu.style.display == 'none';
        menu.style.display = hidden ? 'flex' : 'none';
        mbar.style.background = hidden ? '#aaa' : '';
        if (hidden) $('#play').focus ();    // menu is zichtbaar !
    });
    menu.addEventListener ('click', function (ev) {
        ev.stopPropagation ();  // anders krijgt notation/body/svg ook de click
    });
    hasSmooth = CSS.supports ('scroll-behavior', 'smooth');
    await parsePreload ();  // wacht tot parameters toegekend zijn
    resizeNotation ();
    var ac = window.AudioContext || window.webkitAudioContext;
    audioCtx = ac != undefined ? new ac () : null;
    var m = ['Your browser does not support:'], m2 = 0;
    if (!hasSmooth) m.push ('* smooth scrolling');
    if (!audioCtx) { m.push ('* the Web Audio API -> no sound');
    } else {
        if (!audioCtx.createStereoPanner) hasPan = 0;
        if (!audioCtx.createOscillator) hasLFO = 0;
        if (!audioCtx.createBiquadFilter) hasFlt = 0;
        if (!audioCtx.createConstantSource) hasVCF = 0;
        //~ audioCtx.suspend ();   // test suspension
        if (!hasPan) m.push ('* the StereoPanner element');
        if (withRT && !hasLFO) { m.push ('* the Oscillator element'); m2 = 1; }
        if (withRT && !hasFlt) { m.push ('* the BiquadFilter element'); m2 = 1; }
        if (withRT && !hasVCF) { m.push ('* the ConstantSource element'); m2 = 1; }
        if (m2) {
            m.push ('You are probably on iOS, which does not support the Web Audio API.')
            m.push ('Real time synthesis is switched off, falling back to MIDIjs')
            withRT = 0;
            document.getElementById ('midijs').checked = 'true';
        }
    }
    if (m.length > 1) alert (m.join ('\n'));
    document.getElementById ('verlab').innerHTML = '<span>Version:</span>' + xmlplay_VERSION;
    $('#fscr').on ('change', setFullscreen);
    $('body').on ('fullscreenchange webkitfullscreenchange mozfullscreenchange', function () {
        var e = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
        $('#fscr').prop ('checked', e != null);
    });
    document.body.addEventListener ('keydown', keyDown);
    document.body.addEventListener ('click', evt => {
        if (menu.style.display != 'none') $('#mbar').click ()   // sluit menu
    });
    document.getElementById ('midijs').addEventListener ('click', evt => { withRT = 0; laadNoot (); });
    document.getElementById ('sf2').addEventListener ('click', evt => { withRT = 1; laadNoot (); });
});

})();
