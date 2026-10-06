// Drehbücher „Studie erklärt" für FullRep.
// ⚠ Jede Zahl stammt wörtlich aus mypeak/src/data/peakPrograms.js
// (STUDY-Bibliothek bzw. das genannte Programm). Nichts erfinden.
// `p` = Index der Phrase im Sprechertext (Teilung an . , ? :), ab der etwas erscheint.
export const REELS = {
  gibala: { // STUDY.gibala2006, Programm gibala_sit (60/75, RPE 8–9, 8 Runden, 3×/Woche)
    szenen: [
      { k: 'STUDIE ERKLÄRT', titel: 'Ausdauer braucht <em>Stunden</em>?', vo: 'Ausdauer braucht Stunden? Nicht unbedingt.',
        v: { typ: 'uhr', stempel: { text: 'NICHT<br>UNBEDINGT', p: 1 } } },
      // Phrasen: 0 Forscher… · 1 Eine Gruppe… · 2 Die andere…
      { k: 'DIE STUDIE', titel: 'Sprints gegen <em>Dauertraining</em>', vo: 'Forscher um Martin Gibala haben es getestet. Eine Gruppe machte sechs Einheiten Sprint-Intervalle in zwei Wochen. Die andere klassisches Ausdauertraining.',
        v: { typ: 'zahlen', zp: 1, zahlen: [['2', 'WOCHEN'], ['6', 'EINHEITEN']], karten: [['GRUPPE 1', 'Kurze Sprint-Intervalle', 1.6], ['GRUPPE 2', 'Klassisches Ausdauertraining', 2]] } },
      // 0 Die Sprint-Gruppe… · 1 Die andere… · 2 Im Muskel? · 3 Ähnliche Anpassungen.
      { k: 'DAS ERGEBNIS', titel: 'Die <em>Trainingszeit</em>', vo: 'Die Sprint-Gruppe trainierte rund zweieinhalb Stunden. Die andere rund zehneinhalb. Im Muskel? Ähnliche Anpassungen.',
        v: { typ: 'punkte', legende: '1 Punkt = 15 Min.', reihen: [{ label: 'SPRINT-GRUPPE', n: 10, p: 0, wert: '≈ 2,5 h' }, { label: 'AUSDAUER-GRUPPE', n: 42, p: 1, wert: '≈ 10,5 h' }], band: { text: 'Im Muskel: ähnliche Anpassungen', p: 3 } } },
      // 0 Der Haken: · 1 Kurz heißt nicht leicht.
      { k: 'DER HAKEN', titel: 'Kurz heißt nicht <em>leicht</em>', vo: 'Der Haken: Kurz heißt nicht leicht.',
        v: { typ: 'treppe', p: 1, bis: 8.5, wert: '8–9 von 10' } },
      // 0 So startest du: · 1 sechzig… hart, · 2 fünfundsiebzig locker. · 3 Acht Runden, · 4 dreimal…
      { k: 'FÜR DEIN TRAINING', titel: 'So <em>startest</em> du', vo: 'So startest du: sechzig Sekunden hart, fünfundsiebzig locker. Acht Runden, dreimal pro Woche.',
        v: { typ: 'schritte', schritte: [['60 s hart', 1], ['75 s locker bewegen', 2], ['8 Runden · 3× pro Woche', 3]], ablauf: { runden: 8, hart: 60, pause: 75, p: 3 } } },
      { k: '', titel: '', vo: 'Den Plan findest du in FullRep.', v: { typ: 'end', zeile: 'Gibala-Protokoll 60/75<br>fertig in der App' } },
    ],
  },
  trizeps: { // Maeo et al. 2023, Eur J Sport Sci 23(7):1240–1250, PMID 35819335 (Abstract gelesen 06.10.2026).
    // 21 Erwachsene, Kabel-Trizepsstrecken, ein Arm über Kopf, einer neutral, 70 % 1RM, 5×10, 2×/Woche, 12 Wochen.
    // Ganzer Trizeps +19,9 % vs. +13,9 %; langer Kopf +28,5 % vs. +19,6 %; über Kopf stets 34–39 % weniger Gewicht.
    // FullRep-Übung: overhead-tricep-extension = „Trizepsstrecken überkopf“ (Kurzhantel in der App).
    clip: 'quellen/trizeps-seite-480p.mp4',
    szenen: [
      // 0 Trizeps über Kopf trainieren? · 1 Lohnt sich.
      { k: 'STUDIE ERKLÄRT', titel: 'Trizeps: <em>Arm unten</em> oder <em>über Kopf</em>?', vo: 'Trizeps über Kopf trainieren? Lohnt sich.',
        v: { typ: 'clip', stempel: { text: 'LOHNT SICH', p: 1, top: 600 } } },
      // 0 Forscher in Japan testeten es zwölf Wochen lang. · 1 Ein Arm trainierte über Kopf, · 2 der andere am Körper.
      { k: 'DIE STUDIE', titel: 'Ein Arm <em>über Kopf</em>, einer unten', vo: 'Forscher in Japan testeten es zwölf Wochen lang. Ein Arm trainierte über Kopf, der andere am Körper.',
        v: { typ: 'zahlen', zp: 0.3, zahlen: [['21', 'PERSONEN'], ['12', 'WOCHEN']], karten: [['ARM 1', 'Über Kopf', 1], ['ARM 2', 'Am Körper', 2]] } },
      // 0 Über Kopf wuchs der Trizeps um knapp zwanzig Prozent. · 1 Am Körper um knapp vierzehn.
      { k: 'DAS ERGEBNIS', titel: 'Muskel<em>wachstum</em>', vo: 'Über Kopf wuchs der Trizeps um knapp zwanzig Prozent. Am Körper um knapp vierzehn.',
        v: { typ: 'balken', reihen: [{ label: 'ÜBER KOPF · GANZER TRIZEPS', wert: '+19,9 %', anteil: 1, p: 0 }, { label: 'AM KÖRPER · GANZER TRIZEPS', wert: '+13,9 %', anteil: 0.7, p: 1 }] } },
      // 0 Der Haken: · 1 rund ein Drittel weniger Gewicht. · 2 Und trotzdem mehr Wachstum.
      { k: 'DER HAKEN', titel: 'Mit <em>weniger</em> Gewicht', vo: 'Der Haken: rund ein Drittel weniger Gewicht. Und trotzdem mehr Wachstum.',
        v: { typ: 'balken', reihen: [{ label: 'AM KÖRPER · GEWICHT', wert: '100 %', anteil: 1, p: 1 }, { label: 'ÜBER KOPF · GEWICHT', wert: '−34 bis −39 %', anteil: 0.63, p: 1.5 }], band: { text: 'Trotzdem mehr Wachstum', p: 2 } } },
      // 0 Der Grund: · 1 Über Kopf wird der lange Kopf stärker gedehnt. · 2 Er wuchs sogar um über achtundzwanzig Prozent.
      { k: 'DER GRUND', titel: 'Der lange Kopf wird <em>gedehnt</em>', vo: 'Der Grund: Über Kopf wird der lange Kopf stärker gedehnt. Er wuchs sogar um über achtundzwanzig Prozent.',
        v: { typ: 'clip', tags: [['LANGER KOPF · STÄRKER GEDEHNT', 1, 72, 40], ['+28,5 % (am Körper +19,6 %)', 2, 72, 120]] } },
      // 0 So setzt du es um: · 1 über Kopf, · 2 fünf mal zehn Wiederholungen, · 3 zweimal pro Woche.
      { k: 'FÜR DEIN TRAINING', titel: 'So setzt du es <em>um</em>', vo: 'So setzt du es um: über Kopf, fünf mal zehn Wiederholungen, zweimal pro Woche.',
        v: { typ: 'schritte', schritte: [['Trizepsstrecken über Kopf', 1], ['5 Sätze × 10 Wdh.', 2], ['2× pro Woche', 3]] } },
      { k: '', titel: '', vo: 'Die Übung findest du in FullRep.', v: { typ: 'end', zeile: 'Trizepsstrecken überkopf<br>in der App' } },
    ],
  },
};
