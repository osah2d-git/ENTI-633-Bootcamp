export interface TestCase {
  id: string;
  title: string;
  weekName: string;
  tag: string;
  description: string;
  rawText: string;
  expectedVerdict?: 'ahead' | 'on plan' | 'behind';
  expectedSwingsCancelled?: boolean;
  isMissingPlan?: boolean;
}

export const TEST_CASES: TestCase[] = [
  {
    id: 'week-38',
    title: 'Week 38 (Test 1)',
    weekName: 'Week 38',
    tag: 'Ahead (+3.7%)',
    description: 'Maple Ridge Outfitters Week 38. Total $1.9M ahead of plan (+3.7%, +4.9% vs LY). Chinook & Outerwear lead gains.',
    expectedVerdict: 'ahead',
    rawText: `Maple Ridge Outfitters, Prairie region, Week 38 (ending Sep 26, 2026)

| Store | Net sales ($) | Plan ($) | Last year ($) |
| --- | --- | --- | --- |
| Calgary Chinook | 470,500 | 428,500 | 423,900 |
| Calgary Crowfoot | 377,900 | 351,500 | 349,300 |
| Edmonton South | 413,300 | 410,800 | 404,800 |
| Edmonton West | 309,200 | 313,000 | 308,300 |
| Red Deer | 198,400 | 195,500 | 194,100 |
| Lethbridge | 151,200 | 151,800 | 149,700 |
| Total | 1,920,500 | 1,851,100 | 1,830,100 |

| Category | Net sales ($) | Plan ($) |
| --- | --- | --- |
| Outerwear | 781,500 | 703,400 |
| Footwear | 501,000 | 499,800 |
| Camping | 357,800 | 370,200 |
| Accessories | 280,200 | 277,700 |

Store ops notes: none`,
  },
  {
    id: 'week-39',
    title: 'Week 39 (Test 2)',
    weekName: 'Week 39',
    tag: 'Behind (-4.3%)',
    description: 'Maple Ridge Outfitters Week 39. Behind plan (-4.3%, -2.0% vs LY). Red Deer outage cause noted.',
    expectedVerdict: 'behind',
    rawText: `Maple Ridge Outfitters, Prairie region, Week 39 (ending Oct 3, 2026)

| Store | Net sales ($) | Plan ($) | Last year ($) |
| --- | --- | --- | --- |
| Calgary Chinook | 427,500 | 436,700 | 425,800 |
| Calgary Crowfoot | 341,100 | 358,300 | 349,800 |
| Edmonton South | 406,100 | 418,700 | 410,600 |
| Edmonton West | 313,700 | 319,100 | 313,100 |
| Red Deer | 164,400 | 199,300 | 193,000 |
| Lethbridge | 153,400 | 154,800 | 151,400 |
| Total | 1,806,200 | 1,886,900 | 1,843,700 |

| Category | Net sales ($) | Plan ($) |
| --- | --- | --- |
| Outerwear | 695,800 | 717,000 |
| Footwear | 482,200 | 509,500 |
| Camping | 346,600 | 377,400 |
| Accessories | 281,600 | 283,000 |

Store ops notes: Red Deer closed all day Sat Oct 3 (power outage in the plaza).`,
  },
  {
    id: 'week-40',
    title: 'Week 40 (Test 3)',
    weekName: 'Week 40',
    tag: 'On Plan (Swings Cancelled)',
    description: 'Maple Ridge Outfitters Week 40. Total on plan (+0.3%), but Chinook (+8.3%) and Edm South (-7.9%) swung >5%.',
    expectedVerdict: 'on plan',
    expectedSwingsCancelled: true,
    rawText: `Maple Ridge Outfitters, Prairie region, Week 40 (ending Oct 10, 2026)

| Store | Net sales ($) | Plan ($) | Last year ($) |
| --- | --- | --- | --- |
| Calgary Chinook | 481,900 | 445,000 | 454,600 |
| Calgary Crowfoot | 361,400 | 365,000 | 357,100 |
| Edmonton South | 392,900 | 426,600 | 415,800 |
| Edmonton West | 329,700 | 325,100 | 320,400 |
| Red Deer | 204,600 | 203,000 | 200,000 |
| Lethbridge | 156,800 | 157,700 | 156,200 |
| Total | 1,927,300 | 1,922,400 | 1,904,100 |

| Category | Net sales ($) | Plan ($) |
| --- | --- | --- |
| Outerwear | 748,900 | 730,500 |
| Footwear | 520,100 | 519,000 |
| Camping | 372,700 | 384,500 |
| Accessories | 285,600 | 288,400 |

Store ops notes: none`,
  },
  {
    id: 'week-41',
    title: 'Week 41 (Test 4)',
    weekName: 'Week 41',
    tag: 'Messy Paste',
    description: 'fwd: wk41 numbers. Mixed CSV, quotes, $M/$K suffixes, repeated headers, inline categories & notes.',
    expectedVerdict: 'on plan',
    rawText: `fwd: wk41 numbers (sorry, pulled from 2 systems)

STORE,SALES,PLAN,LY
Calgary Chinook,"469,700",461400.00,$454.7K
calgary crowfoot,$0.3884M,"378,600",373500
EDMONTON SOUTH,427400,$442.4K,"432,600"
STORE,SALES,PLAN,LY
Edm West,$340.1K,337100,330800.00
Red Deer,"220,500","210,600",
Lethbridge,150300,163500,"159,000"
TOTAL,1996400,1993600,n/a

cats: outerwear 754,800 vs plan 757,600 / footwear $556.0K vs $538.3K / camping 386200 (plan 398700) / acc. 299,400, plan 299,000

notes from store calls: Chinook says new parka wall is up. Crowfoot asked about holiday staffing again. Edm South had two staff off sick midweek but says traffic was normal. Red Deer LY figure missing from the extract, finance to resend. Lethbridge nothing to report. Reminder that the Q4 plan refresh lands Nov 6 and the format of this file will change after that.`,
  },
  {
    id: 'week-42',
    title: 'Week 42 (Test 5)',
    weekName: 'Week 42',
    tag: 'No Plan Column',
    description: 'Maple Ridge Outfitters Week 42. Missing Plan column -> clearly requests Plan figures without calling Gemini.',
    isMissingPlan: true,
    rawText: `Maple Ridge Outfitters, Prairie region, Week 42 (ending Oct 24, 2026)

| Store | Net sales ($) | Last year ($) |
| --- | --- | --- |
| Calgary Chinook | 467,200 | 463,000 |
| Calgary Crowfoot | 400,700 | 380,900 |
| Edmonton South | 464,200 | 446,300 |
| Edmonton West | 344,500 | 340,800 |
| Red Deer | 210,600 | 212,300 |
| Lethbridge | 177,800 | 165,500 |
| Total | 2,065,000 | 2,008,800 |

| Category | Net sales ($) |
| --- | --- |
| Outerwear | 789,200 |
| Footwear | 564,600 |
| Camping | 403,900 |
| Accessories | 307,300 |

Store ops notes: none`,
  },
];
