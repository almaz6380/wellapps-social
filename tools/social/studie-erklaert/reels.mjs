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
  rauchen: { // Swaply, Kategorie „Nikotin & Vaping“. Inhalte aus swaply/src/i18n/de.ts (categories.nicotine):
    // Auslöser „Nach dem Kaffee“, Belohnung „Pause“, Ersatz „5 tiefe, langsame Atemzüge (imitiert das Ziehen)“,
    // „Ein Glas Wasser trinken“, Intervention „Ein Verlangen dauert meist nur 3–5 Min“. Prinzip: Duhigg,
    // „Golden Rule of Habit Change“ (swaply/src/data/categories.ts). Studie siehe Szene „Die Studie“. Keine Therapieversprechen.
    marke: 'swaply',
    szenen: [
      // 0 Mit dem Rauchen aufhören? · 1 Probier es mit Tauschen.
      { k: 'ERKLÄRT', titel: 'Rauchen: <em>aufhören</em> oder <em>tauschen</em>?', vo: 'Mit dem Rauchen aufhören? Probier es mit Tauschen.',
        v: { typ: 'zigarette', stempel: { text: 'TAUSCHEN', p: 1, top: 600 } } },
      // 0 Jede Gewohnheit hat drei Teile: · 1 Auslöser, · 2 Routine, · 3 Belohnung.
      { k: 'DIE SCHLEIFE', titel: 'Jede Gewohnheit hat <em>drei Teile</em>', vo: 'Jede Gewohnheit hat drei Teile: Auslöser, Routine, Belohnung.',
        v: { typ: 'schleife', knoten: [{ label: 'AUSLÖSER', wert: '', p: 1 }, { label: 'ROUTINE', wert: '', p: 2 }, { label: 'BELOHNUNG', wert: '', p: 3 }] } },
      // 0 Der Auslöser: · 1 der Kaffee. · 2 Die Routine: · 3 die Zigarette. · 4 Die Belohnung: · 5 eine kurze Pause.
      { k: 'BEIM RAUCHEN', titel: 'Die Schleife beim <em>Rauchen</em>', vo: 'Der Auslöser: der Kaffee. Die Routine: die Zigarette. Die Belohnung: eine kurze Pause.',
        v: { typ: 'schleife', knoten: [{ label: 'AUSLÖSER', wert: 'Kaffee', p: 1 }, { label: 'ROUTINE', wert: 'Zigarette', p: 3 }, { label: 'BELOHNUNG', wert: 'Kurze Pause', p: 5 }] } },
      // 0 Der Trick: · 1 Auslöser und Belohnung bleiben. · 2 Nur die Routine wird getauscht.
      { k: 'DER TRICK', titel: 'Nur die <em>Routine</em> tauschen', vo: 'Der Trick: Auslöser und Belohnung bleiben. Nur die Routine wird getauscht.',
        v: { typ: 'schleife', knoten: [{ label: 'AUSLÖSER', wert: 'Kaffee', p: 0 }, { label: 'ROUTINE', wert: 'Zigarette', p: 0 }, { label: 'BELOHNUNG', wert: 'Kurze Pause', p: 0 }], tausch: { neu: '5 tiefe Atemzüge', p: 2 } } },
      // Studie: McClernon, Westman & Rose 2004, Addict Behav 29(4):765–772, PMID 15135559 (Abstract gelesen 06.10.2026).
      // Abhängige Raucher, zwei Laborsitzungen, je 4 h ohne Rauchen; einmal alle 30 Min. eine Reihe tiefer Atemzüge,
      // einmal ruhig sitzen. Tiefes Atmen senkte Verlangen und negative Stimmung (angespannt, gereizt) signifikant,
      // Wachheit/Konzentration blieben auf Ausgangsniveau. Laut Autoren eine vorläufige Studie, keine Zahlen im Abstract.
      // 0 Hilft das? · 1 Die Duke University hat es getestet. · 2 Raucher verzichteten vier Stunden, · 3 mal mit tiefen Atemzügen, · 4 mal ohne.
      { k: 'DIE STUDIE', titel: 'Hilft <em>tiefes Atmen</em>?', vo: 'Hilft das? Die Duke University hat es getestet. Raucher verzichteten vier Stunden, mal mit tiefen Atemzügen, mal ohne.',
        v: { typ: 'zahlen', zp: 2, zahlen: [['4', 'STUNDEN OHNE RAUCHEN'], ['2', 'DURCHGÄNGE']], karten: [['DURCHGANG 1', 'Tiefe Atemzüge alle 30 Min.', 3], ['DURCHGANG 2', 'Nur ruhig sitzen', 4]] } },
      // 0 Mit Atemzügen: · 1 weniger Verlangen, · 2 weniger gereizt. · 3 Und trotzdem wach.
      { k: 'DAS ERGEBNIS', titel: 'Weniger <em>Verlangen</em>', vo: 'Mit Atemzügen: weniger Verlangen, weniger gereizt. Und trotzdem wach.',
        v: { typ: 'sieger', p: 1, karten: [['MIT TIEFEN ATEMZÜGEN', 'Weniger Verlangen, weniger gereizt', true], ['NUR RUHIG SITZEN', 'Stärkeres Verlangen', false]], band: { text: 'Und trotzdem wach und konzentriert', p: 3 } } },
      // 0 So tauschst du: · 1 fünfmal tief atmen, · 2 dann ein Glas Wasser. · 3 Das Verlangen ebbt nach Minuten ab.
      { k: 'FÜR DEINEN TAUSCH', titel: 'Wenn das <em>Verlangen</em> kommt', vo: 'So tauschst du: fünfmal tief atmen, dann ein Glas Wasser. Das Verlangen ebbt nach Minuten ab.',
        v: { typ: 'schritte', schritte: [['5× tief und langsam atmen', 1], ['Ein Glas Wasser trinken', 2], ['Das Verlangen ebbt nach Minuten ab', 3]] } },
      { k: '', titel: '', vo: 'Deinen Tausch planst du mit Swaply.', v: { typ: 'end', zeile: 'Gewohnheiten tauschen<br>statt abgewöhnen', klein: 'Swaply ersetzt keine ärztliche Hilfe oder Suchtberatung.' } },
    ],
  },
};
