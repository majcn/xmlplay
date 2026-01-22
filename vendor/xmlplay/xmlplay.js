//~ xmlplay, Revision: 181, Copyright (C) 2016-2025: Willem Vree, contributions Stéphane David.
//~ This program is free software; you can redistribute it and/or modify it under the terms of the
//~ GNU General Public License as published by the Free Software Foundation; either version 2 of
//~ the License, or (at your option) any later version.
//~ This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//~ without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//~ See the GNU General Public License for more details. <http://www.gnu.org/licenses/gpl.html>.

'use strict'
var xmlplay_VERSION = 181;
import * as mLib from './xmlplay_lib.js';
import * as sLib from './xmlplay_syn.js';

(function () {
    var opt = {
        speed: 1.0,     // initial value of the menu item: speed
        curmsk: 0,      // cursor mask
        sf2url1: './',  // path to directory containing sound SF2 fonts
        sf2url2: '',    // fall back path
        instTab: {},    // { instrument number -> instrument name } for non standard instrument names
        midijsUrl1: './',       // path to directory containing sound MIDI-js fonts
        midijsUrl2: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/',
        instList: {},   // {voice number: instrument number} (override %%MIDI)
        transMap: {},   // stem nummer -> transpositie
        burak: 0,       // fast playback of appogiatura and tremolo
        nosm: 0,        // no smooth scrolling
        noDash: 0       // hide dotted line
    }
    var gAbcSave, gAbcTxt, scoreFnm;
    var isPlaying = 0, hasSmooth;
    var audioCtx = null;
    var midiUsedArr = [];   // midi nums in score
    var notationHeight = 100;
    var fileURL = '';
    var drop_files = null;
    var mapTab = {};    // { map_name + ABC_note -> midi_number }
    var midiVol = [];   // volume for each voice from midi controller 7
    var midiPan = [];   // panning for each voice from midi controller 10
    var midiInstr = []; // instrument for each voice from midi program
    var vce2stf = {};   // voice id => staff number
    var stf2name = {};  // staff number => staff name
    var abcElm = null;  // contains the svg elements (score)
    var cmpDlg, errElm, abcfile, fknElm, tmpElm, drpuse, drplbl, mbar, menu, playbk, playbtn, fscrbox;
    var alrtMsg2 = 'Your browser has no Web Audio API -> no playback.'
    var gTempo = 120;
    var withRT = 1;     // enable real time synthesis, otherwise pre-rendered waves (MIDIjs)
    var noPF = 0;       // do not translate xml page format
    var noLB = 0;       // do not translate xml line breaks
    var hasPan = 1, hasLFO = 1, hasFlt = 1, hasVCF = 1; // web audio api support
    var gAccTime;       // som van de ABC tijden in millisecondes (plus de starttijd)
    var instMap;        // midi-instrument => midi-instrument voor dynamische klankverandering
    var debug = 0;      // print debug messages
    var tabHaak;        // functie strtab.set_Hooks als module strtab geladen is
    const svg36 = ['%%beginsvg','<defs>',
    '<text id="acc1_3" x="-1">&#xe261; <tspan x="-6" y="-4" style="font-size:14px">&#8593;</tspan></text>',
    '<text id="acc2_3" x="-1">&#xe262; <tspan x="-5" y="14" style="font-size:14px">&#8595;</tspan></text>',
    '<text id="acc4_3" x="-1">&#xe262; <tspan x="-5" y="-4" style="font-size:14px">&#8593;</tspan></text>',
    '<text id="acc-4_3" x="-2">&#xe260; <tspan x="-8.2" y="9" style="font-size:16px">&#8595;</tspan></text>',
    '<text id="acc-2_3" x="-1">&#xe260; <tspan x="-7.3" y="-1" style="font-size:16px">&#8593;</tspan></text>',
    '<text id="acc-1_3" x="-1">&#xe261; <tspan x="-2" y="12" style="font-size:14px">&#8595;</tspan></text>',
    '</defs>','%%endsvg'].join ('\n')

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

function logerr (s) { errElm.innerHTML += s + '\n'; }
function logcmp (s) { logerr (s); cmpDlg.innerHTML += s + '<br>'}

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
    const rvm = new RegExp (/V:\w+\s*tab.*voicemap/, "s");
    if (abctxt.match (rvm) != null) {
        delete abc2svg.mhooks ['strtab'];
    } else if (tabHaak) {
        abc2svg.mhooks ['strtab'] = tabHaak;
    }
    const get_playing = () => isPlaying;
    var voiceMapNames;
    const fplay = 1;
    if (fplay) {
        if (abctxt.indexOf ('I:percmap') >= 0) abctxt = mLib.perc2map (abctxt);
        if (abctxt.indexOf ('%%map') >= 0) [voiceMapNames, mapTab] = mLib.mapPerc (abctxt);
    }
    if (abctxt.includes ('temperamentequal')) abctxt = svg36 + '\n' + abctxt;
    gAbcSave = abctxt;  // bewaar abc met wijzigingen
    if (fplay) {
        var abctxtTemp = abctxt;                // only disable maps during model parsing
        for (var vmapnm in voiceMapNames) {     // disable the voicemaps for tablature
            var nm1 = '%%voicemap ' + vmapnm;   // to get correct fractional midi numbers
            var nm2 = nm1.replace ('%voicemap', '_________')
            abctxtTemp = abctxtTemp.replaceAll (nm1, nm2)
        }

        tmpElm.value = opt.speed;
        gAbcTxt = abctxtTemp;

        mLib.doModel (abctxtTemp, opt, gTempo=120, debug, mapTab, logerr);
        midiVol = mLib.midiVol;
        midiPan = mLib.midiPan;
        midiInstr = mLib.midiInstr;
        midiUsedArr = mLib.midiUsedArr;
        stf2name = mLib.stf2name;
        vce2stf = mLib.vce2stf;

        instMap = Array (256).fill (1).map ((x,i) => i) // instMap [i] => i
        laadNoot ();
    }
    mLib.doLayout ( abctxt, opt, null, fplay, abcElm, logerr, addUnlockListener, 
                    get_playing, playBack);

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
}

function playBack () {
    if (!mLib.ntsSeq.length) return;
    isPlaying = 1 - isPlaying
    if (isPlaying) {
        playbtn.value = 'Stop';
        playbk.style.display = 'none';
        mLib.start_markeer (audioCtx);
    } else {
        playbtn.value = 'Play';
        mLib.stop_markeer ();
    }
}

function setTempo (inc) {   // is -0.1, 0.1
    var curval = 1 * tmpElm.value;
    tmpElm.value = curval + inc;
}

function keyDown (e) {
    var key = e.key;
    if (document.activeElement == mbar) {   // mbar heeft de focus
        if (key == 'Enter' || key == ' ' || key == 'm') mbarklik ();  // => menu actief
        return;
    }
    if (menu.style.display != 'none') {     // menu is actief
        if (key == 'Escape' || key == 'm') mbarklik ();   // => menu verdwijnt
        return;
    }
    if (e.altKey || e.ctrlKey || e.shiftKey || key == 'Tab') return;  // browser shortcuts
    e.preventDefault ();
    switch (key) {
    case 'ArrowLeft': case 'Left': mLib.naarMaat (-1); break;
    case 'ArrowRight': case 'Right': mLib.naarMaat (1); break;
    case 'ArrowUp': case 'Up': mLib.regelOmhoog (-1); break;
    case 'ArrowDown': case 'Down': mLib.regelOmhoog (1); break;
    case 'm': mbarklik (); break;
    case 't': cmpDlg.style.display = cmpDlg.style.display == 'none' ? 'block' : 'none'; break;
    case ' ': playBack (); break;
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
    if (p.notationHeight != undefined) notationHeight = p.notationHeight;
    if (p.fileURL != undefined) preload = p.fileURL;
    if (p.gTempo != undefined) gTempo = p.gTempo;
    if (p.speed != undefined) opt.speed = p.speed;
    if (p.noCur != undefined) opt.curmsk = p.noCur;
    if (p.noSave != undefined) document.getElementById ('savlbl').style.display = 'none';
    if (p.noMenu != undefined) document.getElementById ('mbar').style.display = 'none';
    if (p.noErr != undefined)  { errElm.style.display = 'none'; errElm.style.height = '0px'; };
    if (p.noPF != undefined) noPF = 1;
    if (p.noLB != undefined) noLB = 1;
    if (p.noRT != undefined) withRT = !p.noRT;
    if (p.noDash != undefined) opt.noDash = 1;
    if (p.nosm != undefined || !hasSmooth) opt.nosm = 1;
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
    parstr = window.location.href.replace ('?dl=0','').split ('?'); // look for parameters in the url;
    if (parstr.length > 1) {
        ps = parstr [1].split ('&');
        for (i = 0; i < ps.length; i++) {
            p = ps [i].replace (/d:(\w{15}\/[^.]+\.)/, 'https://dl.dropboxusercontent.com/s/$1');
            if (p == 'noErr') p_url.noErr = 1;
            else if (p == 'noMenu') p_url.noMenu = 1;
            else if (p == 'noSave') p_url.noSave = 1;
            else if (p == 'noRT') p_url.noRT = 1;     // no realtime sf2, use pre-rendered MIDIjs
            else if (p == 'noPF') p_url.noPF = 1;     // do not translate xml page format
            else if (p == 'noLB') p_url.noLB = 1;     // do not translate xml line breaks
            else if (p == 'noDash') p_url.noDash = 1; // hide the dotted line
            else if (r = p.match (/noCur=([\da-fA-F]{2})/)) p_url.noCur = parseInt (r [1], 16);
            else if (p == 'nosm') p_url.nosm = 1;     // no smooth scrolling
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
    if (mLib.ntsSeq.length) {            // in het begin zijn er geen noten
        mLib.putMarkLoc (mLib.ntsSeq [mLib.iSeq], 2); // 2 == force scroll
    }
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
    if (fscrbox.checked) fscrAan.call (e);
    else fscrUit.call (document);
}

function setMidiVol (v, i) {
    midiVol [i] = 1 * v.value;
    v.parentElement.querySelector ('div').innerHTML = v.value;
    setSynVars ();
}

function setMidiPan (v, i) {
    midiPan [i] = 1 * v.value;
    v.parentElement.querySelector ('div').innerHTML = v.value;
    setSynVars ();
}

function setMidiInst (v, i) {
    const abcInst = midiInstr [i];  // instrument van stem i uit ABC file
    const inst = 1 * v.value;   // nieuw instrument
    instMap [abcInst] = inst;   // verander de instrument afbeelding
    midiUsedArr.push (60 + (inst << 7));    // C5 van nieuw instrument inst
    laadNoot ();    // laad nieuw instrument inst
}

function setSynVars () {
    sLib.setSynVars ( audioCtx, opt, midiVol, midiPan, midiInstr, midiUsedArr,
                      withRT, hasPan, hasLFO, hasFlt, hasVCF, instMap,
                      cmpDlg, logerr);
}

function laadNoot () {
    setSynVars ();
    sLib.laadNoot ();
}

function mbarklik (evt) {
    if (evt) evt.stopPropagation ();
    var hidden = menu.style.display == 'none';
    menu.style.display = hidden ? 'flex' : 'none';
    mbar.style.background = hidden ? '#aaa' : '';
    if (hidden) playbtn.focus ();    // menu is zichtbaar !
}

function fscrChange () {    // update the checkbox
    var e = document.fullscreenElement || document.webkitFullscreenElement;
    fscrbox.checked = e != null;
};

document.addEventListener ('DOMContentLoaded', async function () {
    mLib.addElms ();
    cmpDlg = document.getElementById ('comp');
    abcElm = document.getElementById ('notation');
    errElm = document.getElementById ('err');
    abcfile = document.getElementById ('abcfile');
    fknElm = document.getElementById ('fknp');
    tmpElm = document.getElementById ('tempo');
    playbk = document.getElementById ('playbk');
    playbtn = document.getElementById ('play');
    fscrbox = document.getElementById ('fscr');
    tabHaak = abc2svg.mhooks ['strtab']
    addUnlockListener (playbtn, 'click', playBack);
    addUnlockListener (playbk, 'click', playBack);
    fknElm.addEventListener ('change', readLocalFile);
    document.getElementById ('save').addEventListener ('click', saveLayout);
    window.addEventListener ('resize', function () {
        mLib.setScale ();
        resizeNotation ();
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
    mbar.addEventListener ('click', evt => mbarklik (evt));
    menu.addEventListener ('click', function (ev) {
        ev.stopPropagation ();  // anders krijgt notation/body/svg ook de click
    });
    hasSmooth = CSS.supports ('scroll-behavior', 'smooth');
    var ac = window.AudioContext || window.webkitAudioContext;
    audioCtx = ac != undefined ? new ac () : null;
    await parsePreload ();  // wacht tot parameters toegekend zijn
    resizeNotation ();
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
    fscrbox.addEventListener ('change', setFullscreen);
    document.body.addEventListener ('fullscreenchange', fscrChange);
    document.body.addEventListener ('webkitfullscreenchange', fscrChange);  // for the iPad
    document.body.addEventListener ('keydown', keyDown);
    document.body.addEventListener ('click', evt => {
        if (menu.style.display != 'none') mbarklik ();  // sluit menu
    });
    document.getElementById ('midijs').addEventListener ('click', evt => { withRT = 0; laadNoot (); });
    document.getElementById ('sf2').addEventListener ('click', evt => { withRT = 1; laadNoot (); });
});

})();
