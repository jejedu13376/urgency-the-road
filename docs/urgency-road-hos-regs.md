# Hours of Service (HOS) — Canada, US, EU, Australia

**Purpose:** Reference for Urgency Road Module 13 fatigue scoring and near/over-limit warnings.  
**Not legal advice.** Limits below are simplified defaults for in-app guidance; carriers/drivers remain responsible for full statutory compliance (ELD/eRODS, exemptions, adverse conditions, passenger rules, north-of-60°N, BFM/AFM, etc.).

**App mapping:** `src/services/urgence/hosRegs.ts` → `fatigueScore.ts` (region from country selection / GPS / vehicle profile).

---

## Summary table (solo / property-carrying defaults)

| Region | Max continuous / daily drive | Mandatory break | Daily rest / window | Weekly (or cycle) |
| --- | --- | --- | --- | --- |
| **Canada** (south of 60°N) | **13 h** driving / day; **14 h** on-duty / day; **16 h** work-shift window | Extra off-duty (≥30 min blocks) toward **10 h** off-duty/day (incl. **8 h** consecutive) | **8 h** consecutive off before driving again after 13/14 h; **10 h** off-duty/day | Cycle 1: **70 h** on-duty / **7 d**; Cycle 2: **120 h** / **14 d**; ≥**24 h** off in prior **14 d** |
| **United States** (property CMV) | **11 h** driving inside **14 h** on-duty window after **10 h** off | **30 min** uninterrupted non-driving after **8 h** cumulative driving | **10 h** consecutive off to restart; may not drive after 14th hour | **60 h** / **7 d** or **70 h** / **8 d**; **34 h** restart |
| **EU** (EC 561/2006) | **9 h** daily (extend to **10 h** ≤2×/week) | **45 min** after **4.5 h** driving (or **15+30**) | Daily rest **11 h** (reduced **9 h**); weekly rest **45 h** (reduced **24 h**) | **56 h** driving / week; **90 h** / any **2** consecutive weeks |
| **Australia** (NHVR Standard Hours, solo) | **12 h** work / **24 h**; staged caps (e.g. **5¼ h** / 5½ h) | **15 / 30 / 60 min** rest blocks per rolling window | **7 h** continuous stationary rest / 24 h | **72 h** work / **7 d** (+ **24 h** rest); **144 h** / **14 d** (+ night rests) |

---

## Canada

**Instrument:** *Commercial Vehicle Drivers Hours of Service Regulations* (SOR/2005-313), south of latitude 60°N (ss. 11–29).

| Rule | Limit |
| --- | --- |
| Daily driving | Max **13 hours** driving in a day |
| Daily on-duty | Max **14 hours** on-duty in a day |
| Work-shift window | No driving after **16 hours** elapsed since end of last ≥8 h consecutive off-duty |
| Mandatory off after limits | ≥**8 consecutive hours** off-duty before driving again after hitting 13 h drive or 14 h on-duty |
| Daily off-duty | ≥**10 hours** off-duty/day; **8 h** consecutive + remaining in ≥**30 min** blocks; ≥**2 h** off not part of the 8 h core |
| Cycle 1 | Max **70 h** on-duty in **7 days** |
| Cycle 2 | Max **120 h** on-duty in **14 days**; also ≤**70 h** on-duty without a **24 h** off |
| Long rest | ≥**24 consecutive hours** off in the preceding **14 days** |

**Sources**

- Justice Laws: https://laws-lois.justice.gc.ca/eng/regulations/SOR-2005-313/fulltext.html  
- FMCSA comparison (30-minute / off-duty blocks): https://www.fmcsa.dot.gov/international-programs/do-canada-and-united-states-have-similar-hos-regulations-regarding-30-minute  

**App defaults:** `maxDriveSec = 13h`, `breakAfterDriveSec = 8h` (encourage ≥30 min off), `dailyOnDutySec = 14h`, `weeklyOnDutySec = 70h` (Cycle 1), `warnRatio = 0.85`.

---

## United States

**Instrument:** 49 CFR § 395.3 (property-carrying); FMCSA HOS summary / driver guide.

| Rule | Limit |
| --- | --- |
| Driving | Max **11 hours** after ≥**10 consecutive hours** off-duty |
| Window | May not drive after the **14th consecutive hour** after coming on-duty |
| Break | ≥**30 consecutive minutes** non-driving after **8 cumulative hours** of driving (off-duty, sleeper, or on-duty-not-driving) |
| Weekly | No driving after **60 h** on-duty in **7 consecutive days**, or **70 h** in **8 consecutive days** (carrier calendar) |
| Restart | **34 consecutive hours** off-duty restarts the 7/8-day period |

**Sources**

- eCFR § 395.3: https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395/subpart-A/section-395.3  
- FMCSA summary: https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations  
- FMCSA HOS hub: https://www.fmcsa.dot.gov/regulations/hours-of-service  
- Interstate Truck Driver’s Guide to HOS (PDF): https://www.fmcsa.dot.gov/sites/fmcsa.dot.gov/files/2022-04/FMCSA-HOS-395-DRIVERS-GUIDE-TO-HOS%282022-04-28%29_0.pdf  

**App defaults:** `maxDriveSec = 11h`, `breakAfterDriveSec = 8h` (30 min), `dutyWindowSec = 14h`, `weeklyOnDutySec = 70h`, `warnRatio = 0.85`.

---

## European Union

**Instrument:** Regulation (EC) No **561/2006** (as amended) — driving times and rest periods.

| Rule | Limit |
| --- | --- |
| Daily driving | **9 hours** (may extend to **10 hours** at most **twice** per week) |
| Break | After **4.5 hours** driving → uninterrupted **45 minutes**, or **15 min** then **30 min** |
| Weekly driving | Max **56 hours** |
| Fortnight driving | Max **90 hours** in any two consecutive weeks |
| Daily rest | Regular **11 hours** (reduced **9 hours** under conditions) |
| Weekly rest | Regular **45 hours** (reduced **24 hours** under conditions + compensation) |

**Sources**

- EUR-Lex 561/2006: https://eur-lex.europa.eu/eli/reg/2006/561/oj/eng  
- Consolidated text (2024-05-22): https://eur-lex.europa.eu/eli/reg/2006/561/2024-05-22/eng/pdf  
- European Commission overview: https://transport.ec.europa.eu/transport-modes/road/social-provisions/driving-time-and-rest-periods_en  
- Your Europe summary: https://europa.eu/youreurope/citizens/work/work-abroad/rules-working-road-transport/index_en.htm  

**App defaults:** `maxDriveSec = 9h`, `breakAfterDriveSec = 4.5h` (45 min), `weeklyDriveSec = 56h`, `biweeklyDriveSec = 90h`, `warnRatio = 0.85`.

---

## Australia

**Instrument:** Heavy Vehicle National Law (HVNL) fatigue / **Standard Hours** (solo) — NHVR.

| In any period of | Max work | Min rest |
| --- | --- | --- |
| 5½ hours | **5¼ hours** | **15** continuous minutes |
| 8 hours | **7½ hours** | **30** minutes (15-min blocks) |
| 11 hours | **10 hours** | **60** minutes (15-min blocks) |
| 24 hours | **12 hours** | **7** continuous hours stationary rest |
| 7 days | **72 hours** | **24** continuous hours stationary rest |
| 14 days | **144 hours** | 2× night rest breaks + 2× night rests on consecutive days |

**Sources**

- NHVR work and rest hours: https://www.nhvr.gov.au/safety-accreditation-compliance/fatigue-management/work-and-rest-hours  
- NHVR counting time: https://www.nhvr.gov.au/safety-accreditation-compliance/fatigue-management/counting-time  
- NHVR work diary: https://www.nhvr.gov.au/safety-accreditation-compliance/fatigue-management/work-diary  

**Note:** NHVR pages reference HVNL reforms / transitional arrangements (incl. fitness-to-drive duties). App uses **Standard Hours solo** outer limits only — not BFM/AFM/ACH.

**App defaults:** `maxDriveSec = 12h` (24 h window), `breakAfterDriveSec = 5.25h` (15 min), secondary warn at 7.5 h / 10 h work, `weeklyWorkSec = 72h`, `warnRatio = 0.85`.

---

## Region resolution in the app

Priority (first hit wins):

1. Explicit HOS country/region selection (`CA` | `US` | `EU` | `AU`)
2. ISO country from vehicle profile / locale (`CA`, `US`, `AU`, EU member codes → `EU`)
3. GPS coarse: Australia box → `AU`; North America → `CA` if lat ≥ 49° else `US`; else `EU`

Near-limit warning when any tracked ratio ≥ **85%** of the regional cap; over-limit / hard stop when ≥ **100%** of max drive (or mandatory break overdue).

---

## Disclaimer

This document and the in-app fatigue score are **safety aids**, not a certified ELD, ROADS, or legal compliance system. Always verify against the current official text and carrier policies.

**Live personal display** (`hosLive.ts` + `HosLivePanel`): while GPS motion accumulates, UI shows **legal hours left today** (`maxDrive − drivingSec`) and **next mandatory stop** clock (sooner of break-due vs max-drive), updating as the driver moves. Country chips force `CA` / `US` / `EU` / `AU`.
