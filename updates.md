# PolyRunner — Piano incentivi per viralità e adozione

> Documento di lavoro · novembre 2026
> Obiettivo: far crescere la piattaforma e, allo stesso tempo, far correre di più e meglio le persone.

---

## 0. Principi guida

1. **Chi corre deve vincere quando corre meglio.** Nessun incentivo deve premiare una prestazione peggiore.
2. **Premiare la regolarità, non solo la gara.** Le abitudini si formano con la frequenza (Charness & Gneezy, *Econometrica*, 2009).
3. **Gioco tra amici, non pressione.** Le ricompense devono essere informative e divertenti, non controllanti (Deci, Koestner & Ryan, 1999).
4. **Denaro reale e crediti virtuali restano separati.** Il denaro non entra mai nei mercati predittivi.
5. **Consenso esplicito.** Nessuno diventa oggetto di un mercato senza opt-in.

---

## 1. Loop virale di base

Il cuore della crescita è un ciclo che si ripete per ogni gara.

| Fase | Azione | Leva psicologica |
|---|---|---|
| 1. Creazione | Il runner dichiara una gara e un obiettivo | Impegno pubblico (Cialdini) |
| 2. Invito | Link condivisibile: "Quanto correrò alla Stramilano?" | Curiosità, reciprocità |
| 3. Partecipazione | Gli amici entrano con 1.000 crediti e pronosticano | Bassa frizione, competizione |
| 4. Gara | Notifiche live, il runner sa di essere "seguito" | Audience effect (Zajonc, 1965) |
| 5. Risultato | Card condivisibile: "Il mercato diceva 38:15. Io: 37:52" | Orgoglio, prova sociale |
| 6. Riattivazione | "Prossima gara?" e mercati sugli amici appena arrivati | Fresh start (Dai et al., 2014) |

### Azioni
- [ ] Pagina mercato visibile **senza login** con anteprima e CTA "Fai il tuo pronostico".
- [ ] **Card risultato** automatica (formato storia Instagram/WhatsApp) con il confronto tra tempo reale e consenso del mercato.
- [ ] **Invito con bonus doppio:** chi invita e chi viene invitato ricevono +200 crediti quando l'invitato fa il primo pronostico.
- [ ] Interfaccia in **italiano** come lingua principale.
- [ ] Obiettivo metrico: **K-factor > 1 per ogni mercato creato** (ogni runner porta in media più di un nuovo utente).

---

## 2. Incentivi per chi corre

### 2.1 "Beat the market"
Il runner guadagna crediti se il suo tempo reale è **migliore della mediana prevista** dal mercato. Il premio cresce con il margine.

- Allinea gli interessi: il runner vince solo correndo forte.
- Il consenso diventa un obiettivo-riferimento credibile. I runner si concentrano sotto le soglie di riferimento (Allen, Dechow, Pope & Wu, *Management Science*, 2017).

### 2.2 Obiettivo dichiarato
Il runner fissa il proprio target ("sotto 1:35") e gli amici scommettono Sì/No.
- Bonus se il runner centra l'obiettivo.
- Gli obiettivi specifici e sfidanti migliorano la prestazione più del generico "fai del tuo meglio" (Locke & Latham, 2002).

### 2.3 Regole anti-conflitto di interessi
- [ ] Il runner può comprare **solo esiti più veloci** o "Sì, centro l'obiettivo" su sé stesso.
- [ ] Gli amici non possono creare mercati negativi o derisori senza approvazione del runner.
- [ ] Il runner può nascondere o chiudere un mercato su di sé in qualsiasi momento prima della gara.

### 2.4 PB relativo e inclusivo
Il rimborso pettorale non deve essere riservato a chi fa un record assoluto.
- **Miglioramento personale:** batti la tua media delle ultime 3 gare sulla distanza.
- **Age-grading:** il confronto tiene conto dell'età.
- **Prima volta:** per i principianti, l'obiettivo è arrivare al traguardo.
- **Rientro da infortunio:** obiettivo ridotto e dichiarato.

---

## 3. Incentivi per la regolarità (tra una gara e l'altra)

Le gare sono rare (ogni 3–5 mesi). Senza mercati settimanali l'app si apre poche volte l'anno.

### 3.1 Mercati settimanali automatici
- "Luca correrà 3 volte questa settimana?"
- "Sara supererà 30 km questa settimana?"
- Risolti automaticamente dai dati del dispositivo (vedi sezione 6).

### 3.2 Bonus di rientro
Dopo una settimana saltata, un piccolo bonus per la prima corsa successiva.
- Nella megastudy di Milkman et al. (*Nature*, 2021, oltre 61.000 iscritti a palestre) i premi per tornare dopo un allenamento saltato erano tra gli interventi più efficaci.

### 3.3 Calendario "fresh start"
Campagne lanciate nei momenti di ripartenza: 1° gennaio, inizio mese, lunedì, giorno dopo una gara (Dai, Milkman & Riis, *Management Science*, 2014).

### 3.4 Squadre e club
- Mercati di squadra: "Il gruppo del martedì farà più km del gruppo del giovedì?"
- Il membro meno forte si impegna di più quando conta per il gruppo: effetto Köhler (Feltz et al., 2011).
- La competizione tra gruppi è la forma di gamification più efficace nel trial STEP UP (Patel et al., *JAMA Internal Medicine*, 2019).

---

## 4. Impegno con denaro reale ("Commitment Pot")

### 4.1 Come funziona
1. Il runner sceglie un obiettivo settimanale di km (proposto in base alle sue ultime 4 settimane).
2. Blocca un importo (es. 5–50 €) tramite **preautorizzazione su carta**: l'importo non viene addebitato.
3. Se raggiunge l'obiettivo, la preautorizzazione viene annullata.
4. Se non lo raggiunge, l'importo viene addebitato e **donato a una ONLUS** scelta dall'utente.

### 4.2 Perché funziona
- **Avversione alla perdita:** perdere un importo pesa più che guadagnarlo (Kahneman & Tversky, 1979).
- **Contratti di impegno:** efficaci su fumo (Giné, Karlan & Zinman, 2010) e palestra (Royer, Stehr & Sydnor, 2015).
- **Impostazione in perdita:** più efficace dell'impostazione in guadagno per l'attività fisica (Patel et al., *Annals of Internal Medicine*, 2016).

### 4.3 Regole di progettazione
- [ ] **La piattaforma non incassa mai** i soldi persi: nessun guadagno dal fallimento dell'utente.
- [ ] Obiettivi con **aumento massimo del 10%** a settimana.
- [ ] **2 giorni jolly al mese** (malattia, infortunio), dichiarabili senza giustificazione.
- [ ] **Sospensione** per infortunio con un clic.
- [ ] Funzione **facoltativa e avanzata**: la maggior parte degli utenti non la attiverà (Halpern et al., *NEJM*, 2015), ed è normale.
- [ ] Separazione totale da crediti e mercati.

### 4.4 Da verificare con un legale
- Custodia fondi tramite fornitore regolamentato (es. Stripe), mai su conto proprio.
- Conformità a Codice del Consumo e PSD2.
- Esclusione del perimetro ADM (gioco) e della disciplina dei concorsi a premio (DPR 430/2001).
- Durata massima delle preautorizzazioni sul circuito scelto (in genere circa 7 giorni per le carte standard).

---

## 5. Incentivi commerciali (chi paga)

| Attore | Cosa ottiene | Cosa paga |
|---|---|---|
| Organizzatori di gare | Più iscrizioni, engagement pre-gara, contenuti social | Finanziano il rimborso PB e la visibilità della gara |
| Brand (scarpe, integratori) | Sponsorizzazione di mercati e premi | Fee per mercato o campagna |
| Running club | Leaderboard e sfide private | Abbonamento club |
| Aziende | Sfide di corporate wellness | Licenza per dipendenti |
| Utenti | Premium (statistiche, mercati illimitati, PB relativo) | Abbonamento oppure sblocco con crediti |

### Azioni
- [ ] Pilota con **1 organizzatore milanese**: rimborso PB finanziato da loro per una gara.
- [ ] **Affiliazione** sulle iscrizioni ai pettorali acquistati tramite la piattaforma.
- [ ] Premi fisici dagli sponsor (scarpe, pettorali) in palio per le classifiche, senza conversione dei crediti in denaro.

---

## 6. Verifica delle corse

### 6.1 Vincoli di Strava
- Nuove app limitate a 1 atleta, fino a 10 senza revisione, oltre serve approvazione non garantita.
- I dati di un atleta possono essere mostrati solo a quell'atleta.
- Le piattaforme intermediarie non sono più supportate (giugno 2026).
- Conseguenza: Strava va usato al massimo per login e dati personali, non per i mercati visibili agli amici.

### 6.2 Fonti alternative

| Fonte | Uso | Affidabilità |
|---|---|---|
| Classifiche ufficiali (ENDU, SDAM, TDS…) tramite pettorale | Risoluzione mercati di gara | Molto alta |
| Garmin, Polar, Coros, Suunto (API dirette) | Mercati settimanali, Commitment Pot | Alta |
| Apple HealthKit / Health Connect (app nativa) | Copertura ampia dei dispositivi | Alta |
| Aggregatori (es. Terra) | Integrazione unica, a pagamento | Alta (verificare l'origine dei dati) |
| Upload GPX/FIT | Fallback per i crediti virtuali | Bassa |

### 6.3 Anti-frode
- Coerenza tra passo, cadenza e frequenza cardiaca.
- Rilevamento di picchi di velocità (auto, bici).
- Verifica dei metadati e della sorgente del file.
- Contestazione sociale da parte degli amici con revisione.
- **Livelli di rischio:** crediti virtuali → controllo leggero; denaro reale → solo fonti dirette, niente upload manuali né tapis roulant.

---

## 7. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Runner che rallenta per vincere | Solo esiti "più veloci" su sé stessi |
| Pressione sociale, derisione | Opt-in, mercati negativi bloccabili |
| Sovrallenamento per inseguire PB o km | Aumenti max 10%, giorni jolly, PB relativo |
| Perdita di motivazione intrinseca | Tono ludico, premi informativi, focus sociale |
| Rischio legale gioco/concorsi | Crediti non convertibili, denaro separato e donato, parere legale |
| Mercati vuoti (cold start) | Liquidità iniziale e quote di partenza basate sullo storico del runner |
| Dipendenza da Strava | Classifiche ufficiali + API dei produttori |

---

## 8. Roadmap suggerita

**Fase 1 — 0-2 mesi: validare il loop**
- Italiano, opt-in, regola "solo più veloce", card risultato, inviti con bonus.
- Risoluzione tramite classifiche ufficiali.

**Fase 2 — 2-4 mesi: regolarità**
- Mercati settimanali, bonus di rientro, squadre.
- Integrazione Garmin/Polar.

**Fase 3 — 4-6 mesi: monetizzazione**
- Pilota con un organizzatore, sponsor di mercato, Premium a pagamento.
- Commitment Pot in beta chiusa, dopo parere legale.

---

## 9. Metriche da monitorare

- **K-factor** per mercato creato.
- **% di runner** che creano un mercato sulla propria gara.
- **Retention a 4 settimane** (target: > 30%).
- **Corse settimanali medie** per utente attivo, confrontate con le 4 settimane precedenti all'iscrizione.
- **Tasso di successo dei Commitment Pot** (target: 60–80%: se è più basso gli obiettivi sono troppo ambiziosi).
- **Ricavi per gara** da organizzatori e sponsor.

---

## Riferimenti

- Allen, Dechow, Pope & Wu (2017). Reference-dependent preferences: Evidence from marathon runners. *Management Science*.
- Aral & Nicolaides (2017). Exercise contagion in a global social network. *Nature Communications*.
- Charness & Gneezy (2009). Incentives to exercise. *Econometrica*.
- Dai, Milkman & Riis (2014). The fresh start effect. *Management Science*.
- Deci, Koestner & Ryan (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin*.
- Feltz, Kerr & Irwin (2011). Buddy up: the Köhler effect applied to health games. *Journal of Sport & Exercise Psychology*.
- Giné, Karlan & Zinman (2010). Put your money where your butt is. *American Economic Journal: Applied Economics*.
- Halpern et al. (2015). Randomized trial of four financial-incentive programs for smoking cessation. *New England Journal of Medicine*.
- Kahneman & Tversky (1979). Prospect theory. *Econometrica*.
- Locke & Latham (2002). Building a practically useful theory of goal setting and task motivation. *American Psychologist*.
- Mazeas et al. (2022). Evaluating the effectiveness of gamification on physical activity. *Journal of Medical Internet Research*.
- Milkman et al. (2021). Megastudies improve the impact of applied behavioural science. *Nature*.
- Patel et al. (2016). Framing financial incentives to increase physical activity. *Annals of Internal Medicine*.
- Patel et al. (2019). Effectiveness of behaviorally designed gamification interventions with social incentives. *JAMA Internal Medicine*.
- Royer, Stehr & Sydnor (2015). Incentives, commitments, and habit formation in exercise. *American Economic Journal: Applied Economics*.
- Zajonc (1965). Social facilitation. *Science*.
- Zhang et al. (2016). Support or competition? How online social networks increase physical activity. *Preventive Medicine Reports*.