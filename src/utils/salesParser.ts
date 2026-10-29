import { ParsedSalesData, VarianceItem, Verdict } from '../types/retail.ts';

export function formatMoney(val: number, signed = false): string {
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  let formatted = '';

  if (absVal >= 1_000_000) {
    formatted = `$${(absVal / 1_000_000).toFixed(1)}M`;
  } else {
    formatted = `$${(absVal / 1_000).toFixed(1)}K`;
  }

  if (isNeg) {
    return `-${formatted}`;
  }
  if (signed && val > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

export function formatPercent(val: number): string {
  const rounded = Number(val.toFixed(1));
  const sign = rounded > 0 ? '+' : rounded < 0 ? '' : '+';
  return `${sign}${rounded.toFixed(1)}%`;
}

export function getVerdict(percentVariance: number): Verdict {
  // Verdict rule: above +2% ahead, +-2% on plan, below -2% behind
  if (percentVariance > 2.0) return 'ahead';
  if (percentVariance < -2.0) return 'behind';
  return 'on plan';
}

export function parseNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^["']|["']$/g, '').trim();
  if (!trimmed || /^n\/?a$/i.test(trimmed) || trimmed === '-') return null;

  // Check for M (millions) suffix: e.g. $0.3884M, 1.2M
  const mMatch = trimmed.match(/^[\$]?([0-9.]+)\s*[mM]$/);
  if (mMatch) {
    return Math.round(parseFloat(mMatch[1]) * 1_000_000);
  }

  // Check for K (thousands) suffix: e.g. $454.7K, 500K
  const kMatch = trimmed.match(/^[\$]?([0-9.]+)\s*[kK]$/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1_000);
  }

  // Remove $, commas, spaces, %
  const cleaned = trimmed.replace(/[\$,%\s]/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseInlineCategories(line: string): VarianceItem[] {
  // e.g.: cats: outerwear 754,800 vs plan 757,600 / footwear $556.0K vs $538.3K / camping 386200 (plan 398700) / acc. 299,400, plan 299,000
  const afterColon = line.replace(/^(?:cats|categories)\s*:\s*/i, '');
  const chunks = afterColon.split('/').map((c) => c.trim()).filter(Boolean);
  const items: VarianceItem[] = [];

  for (const chunk of chunks) {
    // extract category name and 2 numbers
    // Patterns:
    // "outerwear 754,800 vs plan 757,600"
    // "footwear $556.0K vs $538.3K"
    // "camping 386200 (plan 398700)"
    // "acc. 299,400, plan 299,000"
    let name = '';
    let netSales: number | null = null;
    let plan: number | null = null;

    const matchVs = chunk.match(/^([a-zA-Z\.\s]+?)\s+([\$0-9,\.kKmM]+)\s+(?:vs\.?\s*plan|vs\.?)\s+([\$0-9,\.kKmM]+)/i);
    const matchParen = chunk.match(/^([a-zA-Z\.\s]+?)\s+([\$0-9,\.kKmM]+)\s*\(plan\s+([\$0-9,\.kKmM]+)\)/i);
    const matchCommaPlan = chunk.match(/^([a-zA-Z\.\s]+?)\s+([\$0-9,\.kKmM]+)\s*,\s*plan\s+([\$0-9,\.kKmM]+)/i);

    if (matchVs) {
      name = matchVs[1].trim();
      netSales = parseNumber(matchVs[2]);
      plan = parseNumber(matchVs[3]);
    } else if (matchParen) {
      name = matchParen[1].trim();
      netSales = parseNumber(matchParen[2]);
      plan = parseNumber(matchParen[3]);
    } else if (matchCommaPlan) {
      name = matchCommaPlan[1].trim();
      netSales = parseNumber(matchCommaPlan[2]);
      plan = parseNumber(matchCommaPlan[3]);
    }

    if (name && netSales !== null && plan !== null) {
      // expand abbreviation like "acc."
      if (/^acc\.?$/i.test(name)) name = 'Accessories';
      else name = name.charAt(0).toUpperCase() + name.slice(1);

      const dollarVariance = netSales - plan;
      const percentVariance = plan > 0 ? (dollarVariance / plan) * 100 : 0;
      items.push({
        name,
        type: 'category',
        netSales,
        plan,
        dollarVariance,
        percentVariance,
        isBeyondThreshold: Math.abs(percentVariance) > 2.0,
        isSwingStore: Math.abs(percentVariance) > 5.0,
      });
    }
  }

  return items;
}

export function parseWeeklySalesTable(rawInput: string): ParsedSalesData {
  const lines = rawInput
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Detect Week
  let week = '';
  let weekNumber: number | undefined;
  const weekRegex = /\b(?:week|wk)\s*[:#-]?\s*(\d+)\b/i;
  for (const line of lines) {
    const match = line.match(weekRegex);
    if (match) {
      weekNumber = parseInt(match[1], 10);
      week = `Week ${weekNumber}`;
      break;
    }
  }

  // 2. Check for Store Notes
  let storeNotes = '';
  const noteLines: string[] = [];
  const notesHeaderRegex = /^(?:store\s*ops\s*notes?|notes\s*from\s*store\s*calls?|store\s*notes?|notes?|comments?|manager\s*notes?)\s*[:\-]\s*(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(notesHeaderRegex);
    if (match) {
      if (match[1] && match[1].trim()) {
        noteLines.push(match[1].trim());
      }
      // collect any subsequent lines that are notes
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (!nextLine.includes('|') && !nextLine.includes('\t') && !nextLine.startsWith('STORE,') && !nextLine.match(/\$\d+/)) {
          noteLines.push(nextLine);
        } else {
          break;
        }
      }
      break;
    }
  }
  storeNotes = noteLines.join(' ').trim();

  // 3. Check for Plan column header or presence
  const hasPlanHeader = lines.some((l) => /\b(plan|target|budget)\b/i.test(l));

  // If no week detected
  if (!week) {
    return {
      week: '',
      hasWeek: false,
      hasPlan: hasPlanHeader,
      missingError: {
        type: 'MISSING_WEEK',
        message: 'Missing Week: Please specify the week number (e.g., Week 38) to generate the commentary.',
      },
      total: createEmptyVariance('Total', 'total'),
      stores: [],
      categories: [],
      storeNotes,
      largestVariances: [],
      swingsCancelledOut: false,
      storesMissingLY: [],
    };
  }

  // If plan header missing
  if (!hasPlanHeader) {
    return {
      week,
      weekNumber,
      hasWeek: true,
      hasPlan: false,
      missingError: {
        type: 'MISSING_PLAN',
        message: `Missing Plan: No Plan column was found in the pasted ${week} table. Please provide the Plan figures to calculate variances and generate the commentary.`,
      },
      total: createEmptyVariance('Total', 'total'),
      stores: [],
      categories: [],
      storeNotes,
      largestVariances: [],
      swingsCancelledOut: false,
      storesMissingLY: [],
    };
  }

  // 4. Parse Rows (Stores, Categories, Total)
  const storeRows: VarianceItem[] = [];
  let categoryRows: VarianceItem[] = [];
  let parsedTotal: VarianceItem | null = null;

  let currentSection: 'stores' | 'categories' | 'unknown' = 'unknown';

  for (const line of lines) {
    // Check section switch
    if (/(?:^|\b)(?:stores?|store\s*breakdown|by\s*store)(?:\b|$)/i.test(line) && !line.includes('$') && !/\d{3,}/.test(line)) {
      currentSection = 'stores';
      continue;
    }
    if (/(?:^|\b)(?:category|categories|by\s*category|dept|department)(?:\b|$)/i.test(line) && !line.includes('$') && !/\d{3,}/.test(line)) {
      currentSection = 'categories';
      continue;
    }
    if (notesHeaderRegex.test(line)) {
      continue;
    }

    // Check for inline categories (e.g., "cats: outerwear 754,800 vs plan 757,600 / ...")
    if (/^(?:cats|categories)\s*:/i.test(line)) {
      const inlineCats = parseInlineCategories(line);
      if (inlineCats.length > 0) {
        categoryRows.push(...inlineCats);
        continue;
      }
    }

    // Split line into cells: by pipe, tab, or CSV
    let cells: string[] = [];
    if (line.includes('|')) {
      cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      // Skip markdown separator row like | --- | --- |
      if (cells.every((c) => /^[-:\s]+$/.test(c))) {
        continue;
      }
    } else if (line.includes('\t')) {
      cells = line.split('\t').map((c) => c.trim()).filter((c) => c.length > 0);
    } else if (line.includes(',')) {
      cells = splitCSVLine(line);
    } else {
      // Space separated or mixed
      const match = line.match(/^([A-Za-z0-9\s\-_#]+?)\s{2,}(\$?[0-9,.]+.*)$/);
      if (match) {
        const restTokens = match[2].split(/\s{2,}|\s+/).filter(Boolean);
        cells = [match[1], ...restTokens];
      }
    }

    if (cells.length < 2) continue;

    // Check if header row (contains "Store", "Net Sales", "Plan", "Last Year")
    const isHeader = cells.some((c) => /^(store|category|dept|name|sales|net\s*sales|plan|last\s*year|ly)$/i.test(c.trim().replace(/^["']|["']$/g, '')));
    if (isHeader) {
      if (cells.some((c) => /category|dept|cats/i.test(c))) {
        currentSection = 'categories';
      } else if (cells.some((c) => /store/i.test(c))) {
        currentSection = 'stores';
      }
      continue;
    }

    const rowName = cells[0].replace(/^["']|["']$/g, '').trim();
    if (/^(store|category|notes?)$/i.test(rowName)) continue;

    // Parse the numbers from remaining cells
    const numbers: (number | null)[] = [];
    for (let c = 1; c < cells.length; c++) {
      const val = parseNumber(cells[c]);
      numbers.push(val);
    }

    // Need at least Net Sales (num 0) and Plan (num 1)
    if (numbers.length < 2 || numbers[0] === null || numbers[1] === null) continue;

    const netSales = numbers[0];
    const plan = numbers[1];
    const lastYear = numbers.length >= 3 && numbers[2] !== null ? numbers[2] : undefined;

    const isTotalRow = /^(total|total\s*stores?|chain|all\s*stores|grand\s*total)$/i.test(rowName);

    const dollarVariance = netSales - plan;
    const percentVariance = plan > 0 ? (dollarVariance / plan) * 100 : 0;
    const lyPercentVariance = lastYear && lastYear > 0 ? ((netSales - lastYear) / lastYear) * 100 : undefined;
    const isBeyondThreshold = Math.abs(percentVariance) > 2.0;
    const isSwingStore = Math.abs(percentVariance) > 5.0;

    const item: VarianceItem = {
      name: rowName,
      type: isTotalRow ? 'total' : currentSection === 'categories' ? 'category' : 'store',
      netSales,
      plan,
      lastYear,
      dollarVariance,
      percentVariance,
      lyPercentVariance,
      isBeyondThreshold,
      isSwingStore,
    };

    if (isTotalRow) {
      parsedTotal = item;
    } else {
      // Determine if store or category
      const looksLikeStore = /store|shop|calgary|chinook|crowfoot|edmonton|edmonton\s*south|edmonton\s*west|edm\s*west|red\s*deer|lethbridge|downtown|west|east|north|south|metro|mall|loc|center|\d{3}/i.test(rowName);
      const looksLikeCategory = /outerwear|camping|apparel|footwear|shoes|clothing|home|electronics|beauty|accessories|sport|grocery|food|toys/i.test(rowName);

      if (currentSection === 'categories' || (looksLikeCategory && !looksLikeStore)) {
        item.type = 'category';
        categoryRows.push(item);
      } else {
        item.type = 'store';
        storeRows.push(item);
      }
    }
  }

  // Identify stores missing last year figure
  const storesMissingLY = storeRows
    .filter((s) => s.lastYear === undefined || s.lastYear === null)
    .map((s) => s.name);
  const storesWithLY = storeRows.filter(
    (s) => s.lastYear !== undefined && s.lastYear !== null && s.lastYear > 0
  );

  // If total row wasn't explicitly found, sum from stores
  if (!parsedTotal) {
    if (storeRows.length > 0) {
      const totalNet = storeRows.reduce((acc, s) => acc + s.netSales, 0);
      const totalPlan = storeRows.reduce((acc, s) => acc + s.plan, 0);
      const totalLY = storesWithLY.reduce((acc, s) => acc + (s.lastYear || 0), 0);
      const dollarVar = totalNet - totalPlan;
      const pctVar = totalPlan > 0 ? (dollarVar / totalPlan) * 100 : 0;

      // When a last-year figure is blank, calculate vs last year using only the stores that have one
      let lyPctVar: number | undefined = undefined;
      if (storesMissingLY.length > 0 && storesWithLY.length > 0) {
        const compNet = storesWithLY.reduce((acc, s) => acc + s.netSales, 0);
        const compLY = storesWithLY.reduce((acc, s) => acc + (s.lastYear as number), 0);
        lyPctVar = compLY > 0 ? ((compNet - compLY) / compLY) * 100 : undefined;
      } else if (totalLY > 0) {
        lyPctVar = ((totalNet - totalLY) / totalLY) * 100;
      }

      parsedTotal = {
        name: 'Total',
        type: 'total',
        netSales: totalNet,
        plan: totalPlan,
        lastYear: totalLY,
        dollarVariance: dollarVar,
        percentVariance: pctVar,
        lyPercentVariance: lyPctVar,
        isBeyondThreshold: Math.abs(pctVar) > 2.0,
      };
    } else {
      parsedTotal = createEmptyVariance('Total', 'total');
    }
  } else {
    // If total row was parsed from table, calculate vs last year using only stores that have one when any store is missing LY
    if (storesMissingLY.length > 0 && storesWithLY.length > 0) {
      const compNet = storesWithLY.reduce((acc, s) => acc + s.netSales, 0);
      const compLY = storesWithLY.reduce((acc, s) => acc + (s.lastYear as number), 0);
      parsedTotal.lyPercentVariance = compLY > 0 ? ((compNet - compLY) / compLY) * 100 : undefined;
      parsedTotal.lastYear = compLY;
    } else if (parsedTotal.lyPercentVariance === undefined && storesWithLY.length > 0) {
      const totalLY = storesWithLY.reduce((acc, s) => acc + (s.lastYear as number), 0);
      parsedTotal.lyPercentVariance = totalLY > 0 ? ((parsedTotal.netSales - totalLY) / totalLY) * 100 : undefined;
      parsedTotal.lastYear = totalLY;
    }
  }

  // 5. Select 2 to 4 largest dollar variances beyond +-2%, gains first
  const beyondThresholdItems = [...storeRows, ...categoryRows].filter((i) => i.isBeyondThreshold);

  // Gains: dollarVariance > 0, sorted descending by dollarVariance
  const gains = beyondThresholdItems
    .filter((i) => i.dollarVariance > 0)
    .sort((a, b) => b.dollarVariance - a.dollarVariance);

  // Losses: dollarVariance < 0, sorted ascending by dollarVariance (i.e. largest negative dollar variance first)
  const losses = beyondThresholdItems
    .filter((i) => i.dollarVariance < 0)
    .sort((a, b) => a.dollarVariance - b.dollarVariance);

  // Take 2 to 4 largest total, gains first
  const selectedVariances: VarianceItem[] = [];
  if (gains.length > 0 && losses.length > 0) {
    selectedVariances.push(...gains.slice(0, 2));
    selectedVariances.push(...losses.slice(0, Math.min(2, 4 - selectedVariances.length)));
  } else if (gains.length > 0) {
    selectedVariances.push(...gains.slice(0, 4));
  } else if (losses.length > 0) {
    selectedVariances.push(...losses.slice(0, 4));
  }

  // If still fewer than 2 and we have other items beyond threshold, fill up to 2
  if (selectedVariances.length < 2 && beyondThresholdItems.length >= 2) {
    for (const item of beyondThresholdItems) {
      if (!selectedVariances.includes(item)) {
        selectedVariances.push(item);
        if (selectedVariances.length >= 2) break;
      }
    }
  }

  // 6. Check Swings Cancelled Out
  // Rule: "if the total is on plan but a store is more than 5% off, say the swings cancelled out."
  const totalVerdict = getVerdict(parsedTotal.percentVariance);
  const hasStoreBeyond5Pct = storeRows.some((s) => Math.abs(s.percentVariance) > 5.0);
  const swingsCancelledOut = totalVerdict === 'on plan' && hasStoreBeyond5Pct;

  return {
    week,
    weekNumber,
    hasWeek: true,
    hasPlan: true,
    total: parsedTotal,
    stores: storeRows,
    categories: categoryRows,
    storeNotes,
    largestVariances: selectedVariances,
    swingsCancelledOut,
    storesMissingLY,
  };
}

function createEmptyVariance(name: string, type: 'total' | 'store' | 'category'): VarianceItem {
  return {
    name,
    type,
    netSales: 0,
    plan: 0,
    dollarVariance: 0,
    percentVariance: 0,
    isBeyondThreshold: false,
  };
}
