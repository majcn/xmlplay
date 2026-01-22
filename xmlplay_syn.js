//~ xmlplay_syn, Revision: 181, Copyright (C) 2016-2025: Willem Vree, contributions Stéphane David.
//~ This program is free software; you can redistribute it and/or modify it under the terms of the
//~ GNU General Public License as published by the Free Software Foundation; either version 2 of
//~ the License, or (at your option) any later version.
//~ This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//~ without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//~ See the GNU General Public License for more details. <http://www.gnu.org/licenses/gpl.html>.

// variables shared with xmlplay.js
var audioCtx;
var opt;
var midiVol;
var midiPan;
var midiInstr;
var midiUsedArr;
var withRT;
var hasPan;
var hasLFO;
var hasFlt;
var hasVCF;
var instMap;
var cmpDlg, logerr;
function setSynVars ( audioCtx_p, opt_p, midiVol_p, midiPan_p, midiInstr_p, midiUsedArr_p,
                      withRT_p, hasPan_p, hasLFO_p, hasFlt_p, hasVCF_p, instMap_p,
                      cmpDlg_p, logerr_p) {
    audioCtx = audioCtx_p;
    opt = opt_p;
    midiVol = midiVol_p;
    midiPan = midiPan_p;
    midiInstr = midiInstr_p;
    midiUsedArr = midiUsedArr_p;
    withRT = withRT_p;
    hasPan = hasPan_p;
    hasLFO = hasLFO_p;
    hasFlt = hasFlt_p;
    hasVCF = hasVCF_p;
    instMap = instMap_p;
    cmpDlg = cmpDlg_p;
    logerr = logerr_p;
}

// variables for the synthszier only
var params = [];    // [instr][key] note parameters per instrument
var rates = [];     // [instr][key] playback rates
var golven = [];
var liggend = [];
var midiLoaded = {};    // midi nums of already loaded MIDIjs waves
var instSf2Loaded = {};
var instArr = [];   // { note_name -> b64 encoded compressed audio } for each loaded SF2 instrument
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
var hasPan = 1, hasLFO = 1, hasFlt = 1, hasVCF = 1; // web audio api support
const volCorJS = 0.5 / 32;  // volume scaling factor for midiJS
const volCorSF = 0.5 / 60;  // idem for Sf2 (60 == volume of !p!)
var gToSynth = 0;

function loginst (s) { logerr (s); cmpDlg.innerHTML += '<div style="white-space: nowrap">' + s + '</div>'}
function logcmp (s) { logerr (s); cmpDlg.innerHTML += s + '<br>'}

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

async function laadNoot (playback) {
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
            if (playback) playback (1); // start playback after loading the notes
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
        var mjsbox = document.getElementById ('midijs');
        if (mjsbox) mjsbox.checked = 'true' // eerst kijken of de checkbox er is!
        var midiNums = midiUsedArr.filter (function (m) { return !(m in midiLoaded); });
        await laadMidiJsArr (Object.keys (instrs), fonturl)
        cmpDlg.innerHTML += 'decode notes:'
        await decodeMidiNums (midiNums);   // only decode samples of notes used in the score
    }
}

export { speel, laadNoot, setSynVars }
