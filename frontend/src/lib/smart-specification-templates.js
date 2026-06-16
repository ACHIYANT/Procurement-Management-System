const GENERAL_SPECIFICATION_GROUP = {
  label: "General",
  suggestions: [
    "Latest configuration",
    "On-site warranty",
    "Installation included",
    "OEM warranty",
  ],
};

export const DEFAULT_SPECIFICATION_TEMPLATES = [
  {
    template_name: "Apple iMac",
    item_name: "Apple iMac",
    keywords: ["apple", "imac", "mac"],
    category_hints: ["computer"],
    subcategory_hints: ["imac", "apple"],
    groups: [
      {
        label: "Processor",
        suggestions: ["Latest M-series chip", "M3 chip", "M4 chip"],
      },
      {
        label: "Memory / Storage",
        suggestions: ["16GB unified memory", "24GB unified memory", "512GB SSD", "1TB SSD"],
      },
      {
        label: "Display / OS",
        suggestions: ["24 inch Retina display", "macOS", "Magic Keyboard and Mouse"],
      },
    ],
    required_details: [
      { label: "Processor / chip", patterns: ["m1", "m2", "m3", "m4", "chip", "processor"] },
      { label: "Memory", patterns: ["memory", "ram", "gb"] },
      { label: "Storage", patterns: ["ssd", "storage", "tb"] },
      { label: "Display", patterns: ["retina", "display", "inch"] },
    ],
  },
  {
    template_name: "Windows All-in-One Desktop",
    item_name: "Windows All-in-One Desktop",
    keywords: ["computer", "desktop", "all-in-one", "aio", "windows"],
    category_hints: ["computer"],
    subcategory_hints: ["all-in-one", "aio", "windows"],
    groups: [
      {
        label: "Processor",
        suggestions: ["Intel i5 latest generation", "Intel i7 14th Gen or latest higher processor", "Intel i9 latest generation"],
      },
      {
        label: "Memory / Storage",
        suggestions: ["8GB RAM", "16GB RAM", "32GB RAM", "512GB SSD", "1TB SSD"],
      },
      {
        label: "OS / Display",
        suggestions: ["Windows 11 Pro", "23.8 inch FHD Display", "Wireless keyboard and mouse"],
      },
    ],
    required_details: [
      { label: "Processor", patterns: ["intel", "i5", "i7", "i9", "processor", "gen"] },
      { label: "RAM", patterns: ["ram"] },
      { label: "Storage", patterns: ["ssd", "hdd", "storage"] },
      { label: "Operating system", patterns: ["windows", "os"] },
      { label: "Display", patterns: ["display", "fhd", "inch"] },
    ],
  },
  {
    template_name: "Monitor",
    item_name: "Monitor / Display Unit",
    keywords: ["monitor", "display"],
    category_hints: ["peripheral", "computer"],
    subcategory_hints: ["monitor", "display"],
    groups: [
      {
        label: "Display",
        suggestions: ["24 inch", "27 inch", "FHD", "QHD", "IPS panel"],
      },
      {
        label: "Connectivity / Features",
        suggestions: ["Screen sharing feature", "HDMI", "DisplayPort", "Height adjustable stand"],
      },
    ],
    required_details: [
      { label: "Screen size", patterns: ["inch", "27", "24"] },
      { label: "Resolution", patterns: ["fhd", "qhd", "4k", "resolution"] },
      { label: "Connectivity", patterns: ["hdmi", "displayport", "vga", "usb-c"] },
    ],
  },
  {
    template_name: "Printer / Scanner",
    item_name: "Printer / Scanner",
    keywords: ["printer", "photocopier", "photostat", "scanner", "laserjet", "adf"],
    category_hints: ["printing", "scanning", "photocopy"],
    subcategory_hints: ["printer", "scanner", "photocopier", "adf", "laser"],
    groups: [
      {
        label: "Type",
        suggestions: ["Monochrome", "Color Laser", "Multifunction", "Single Function"],
      },
      {
        label: "Functions",
        suggestions: ["Print / Scan / Copy", "Duplex printing", "ADF", "Legal size support"],
      },
      {
        label: "Connectivity",
        suggestions: ["USB", "Network / Wi-Fi", "Ethernet"],
      },
    ],
    required_details: [
      { label: "Printer/scanner type", patterns: ["monochrome", "color", "laser", "scanner"] },
      { label: "Functions", patterns: ["print", "scan", "copy", "multifunction", "single function"] },
      { label: "Paper size / ADF", patterns: ["adf", "legal", "a4", "duplex"] },
      { label: "Connectivity", patterns: ["usb", "network", "wi-fi", "ethernet"] },
    ],
  },
  {
    template_name: "UPS",
    item_name: "Offline UPS",
    keywords: ["ups", "power", "backup"],
    category_hints: ["power", "backup", "ups"],
    subcategory_hints: ["offline ups", "ups"],
    groups: [
      {
        label: "Capacity / Type",
        suggestions: ["1 KVA", "2 KVA", "Offline UPS", "Online UPS"],
      },
      {
        label: "Battery / Protection",
        suggestions: ["With battery", "30 minutes backup", "Input voltage protection", "Overload protection"],
      },
    ],
    required_details: [
      { label: "Capacity", patterns: ["kva", "va"] },
      { label: "UPS type", patterns: ["offline", "online", "line interactive"] },
      { label: "Battery backup", patterns: ["battery", "backup"] },
    ],
  },
];

const SMART_TEXT_EXTRACTORS = [
  /\bintel\s+i[3579](?:\s+\d{1,2}(?:th|st|nd|rd)?\s*gen(?:eration)?)?\b/gi,
  /\b\d+\s*gb\s*(?:ddr[3-6]\s*)?(?:ram|unified memory|memory)\b/gi,
  /\b(?:\d+\s*tb|\d+\s*gb)\s*(?:ssd|hdd)\b/gi,
  /\bwindows\s*(?:10|11)\s*(?:pro|home|enterprise)?\b/gi,
  /\b\d{2}(?:\.\d)?\s*(?:"|inch|inches)\s*(?:fhd|qhd|4k|retina|display)?\b/gi,
  /\b(?:fhd|qhd|4k|retina display)\b/gi,
  /\b(?:adf|legal size|duplex printing|multifunction|single function|color laser|monochrome)\b/gi,
  /\b(?:network|wi-fi|wifi|ethernet|usb|hdmi|displayport)\b/gi,
  /\b\d+(?:\.\d+)?\s*kva\b/gi,
  /\b(?:offline ups|online ups|with battery|battery backup|input voltage protection)\b/gi,
];

export const normalizeSuggestionText = (value) =>
  String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

const normalizeSmartText = (value) => normalizeSuggestionText(value).replace(/[-/]/g, " ");

const hasExactSmartPhrase = (value, keyword) => {
  const normalizedValue = ` ${normalizeSmartText(value)} `;
  const normalizedKeyword = normalizeSmartText(keyword);
  return Boolean(normalizedKeyword) && normalizedValue.includes(` ${normalizedKeyword} `);
};

const normalizeTextList = (value = []) => {
  if (Array.isArray(value)) return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const normalizeGroups = (groups = []) =>
  (Array.isArray(groups) ? groups : [])
    .map((group) => ({
      label: String(group?.label || "").trim(),
      suggestions: uniqueSuggestions(normalizeTextList(group?.suggestions)),
    }))
    .filter((group) => group.label && group.suggestions.length);

const normalizeRequiredDetails = (details = []) =>
  (Array.isArray(details) ? details : [])
    .map((detail) => ({
      label: String(detail?.label || "").trim(),
      patterns: uniqueSuggestions(normalizeTextList(detail?.patterns)),
    }))
    .filter((detail) => detail.label && detail.patterns.length);

export const uniqueSuggestions = (values = []) => {
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizeSuggestionText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeSpecificationTemplates = (templates = []) =>
  (Array.isArray(templates) ? templates : [])
    .map((template, index) => ({
      id: template?.id,
      template_name: template?.template_name || template?.title || "",
      item_name: template?.item_name || template?.itemName || "",
      keywords: uniqueSuggestions(
        normalizeTextList(template?.keywords ?? template?.keywords_json),
      ),
      category_hints: uniqueSuggestions(
        normalizeTextList(template?.category_hints ?? template?.categoryHints ?? template?.category_hints_json),
      ),
      subcategory_hints: uniqueSuggestions(
        normalizeTextList(template?.subcategory_hints ?? template?.subcategoryHints ?? template?.subcategory_hints_json),
      ),
      groups: normalizeGroups(template?.groups ?? template?.groups_json),
      required_details: normalizeRequiredDetails(
        template?.required_details ?? template?.requiredDetails ?? template?.required_details_json,
      ),
      sort_order: Number.isFinite(Number(template?.sort_order)) ? Number(template.sort_order) : index + 1,
      is_active: template?.is_active !== false,
    }))
    .filter((template) => template.template_name && template.keywords.length);

const getActiveTemplates = (templates = []) => {
  const normalized = normalizeSpecificationTemplates(templates);
  const active = normalized.filter((template) => template.is_active !== false);
  return active.length ? active : normalizeSpecificationTemplates(DEFAULT_SPECIFICATION_TEMPLATES);
};

const includesAnySmartKeyword = (value, keywords = []) => {
  const normalizedValue = normalizeSmartText(value);
  return keywords.some((keyword) => normalizedValue.includes(normalizeSmartText(keyword)));
};

const getKeywordScore = (value, keywords = []) => {
  const normalizedValue = normalizeSmartText(value);

  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeSmartText(keyword);
    if (!normalizedKeyword) return score;
    if (hasExactSmartPhrase(value, normalizedKeyword)) return Math.max(score, 100);
    if (normalizedKeyword.length > 2 && normalizedValue.includes(normalizedKeyword)) {
      return Math.max(score, 50);
    }
    return score;
  }, 0);
};

const getItemCategoryContext = (item, categories = []) => {
  const category = categories.find(
    (entry) => String(entry.id) === String(item.category_id),
  );
  const subcategory = (category?.subcategories || []).find(
    (entry) => String(entry.id) === String(item.subcategory_id),
  );
  return [category?.category_name, subcategory?.subcategory_name, item.item_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const getMatchedSpecificationProfile = (item, categories = [], templates = []) => {
  const categoryContext = getItemCategoryContext(item, categories);
  const directText = [item.item_name, item.specification].filter(Boolean).join(" ");

  return getActiveTemplates(templates)
    .map((profile) => {
      const directScore = getKeywordScore(directText, profile.keywords);
      const contextScore = getKeywordScore(categoryContext, profile.keywords);
      return {
        profile,
        score: directScore + contextScore / 2,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      return Number(first.profile.sort_order || 100) - Number(second.profile.sort_order || 100);
    })[0]?.profile;
};

export const getSpecificationSuggestionGroups = (item, categories = [], templates = []) => {
  const profile = getMatchedSpecificationProfile(item, categories, templates);
  const groups = profile?.groups?.length
    ? profile.groups
    : [
        {
          label: "Common",
          suggestions: [
            "Latest configuration",
            "As per tender specifications",
            "OEM warranty",
          ],
        },
      ];

  return [...groups, GENERAL_SPECIFICATION_GROUP].map((group) => ({
    ...group,
    suggestions: uniqueSuggestions(group.suggestions),
  }));
};

export const getMissingSpecificationHints = (item, categories = [], templates = []) => {
  const profile = getMatchedSpecificationProfile(item, categories, templates);
  if (!profile?.required_details?.length) return [];

  const specification = normalizeSmartText(
    [item.item_name, item.specification].filter(Boolean).join(" "),
  );
  return profile.required_details
    .filter(
      (detail) =>
        !detail.patterns.some((pattern) =>
          specification.includes(normalizeSmartText(pattern)),
        ),
    )
    .map((detail) => detail.label);
};

const findCategoryByHints = (categories = [], hints = []) =>
  categories.find((category) =>
    includesAnySmartKeyword(category.category_name, hints),
  );

const findSubcategoryByHints = (category, hints = []) =>
  (category?.subcategories || []).find((subcategory) =>
    includesAnySmartKeyword(subcategory.subcategory_name, hints),
  );

const extractSpecificationParts = (text = "") =>
  uniqueSuggestions(
    SMART_TEXT_EXTRACTORS.flatMap((pattern) =>
      Array.from(String(text || "").matchAll(pattern)).map((match) =>
        String(match[0] || "").trim(),
      ),
    ),
  );

const collectConflictValues = (text = "", pattern, normalize) => {
  const values = new Map();

  for (const match of String(text || "").matchAll(pattern)) {
    const value = normalize(match);
    if (!value?.key || !value?.label) continue;
    if (!values.has(value.key)) values.set(value.key, value.label);
  }

  return Array.from(values.values());
};

export const getSpecificationConflictWarnings = (specification = "") => {
  const warnings = [];

  const memoryValues = collectConflictValues(
    specification,
    /\b(\d+)\s*gb\s*(?:ddr([3-6])\s*)?(?:ram|memory|unified memory)\b/gi,
    (match) => ({
      key: `${match[1]}gb`,
      label: `${match[1]}GB${match[2] ? ` DDR${match[2]}` : ""} RAM`,
    }),
  );
  if (memoryValues.length > 1) {
    warnings.push({
      type: "memory",
      message: `Multiple RAM options selected: ${memoryValues.join(", ")}. Keep only the required RAM option.`,
    });
  }

  const osValues = collectConflictValues(
    specification,
    /\bwindows\s*(10|11)\s*(pro|home|enterprise)?\b/gi,
    (match) => ({
      key: `windows-${match[1]}-${String(match[2] || "").toLowerCase()}`,
      label: `Windows ${match[1]}${match[2] ? ` ${match[2]}` : ""}`,
    }),
  );
  if (osValues.length > 1) {
    warnings.push({
      type: "os",
      message: `Multiple operating systems selected: ${osValues.join(", ")}. Keep only one OS.`,
    });
  }

  const processorValues = collectConflictValues(
    specification,
    /\bintel\s+i([3579])(?:\s+\d{1,2}(?:th|st|nd|rd)?\s*gen(?:eration)?)?\b/gi,
    (match) => ({
      key: `intel-i${match[1]}`,
      label: `Intel i${match[1]}`,
    }),
  );
  if (processorValues.length > 1) {
    warnings.push({
      type: "processor",
      message: `Multiple processor tiers selected: ${processorValues.join(", ")}. Keep only the required processor tier.`,
    });
  }

  const storageMatches = Array.from(
    String(specification || "").matchAll(/\b(\d+(?:\.\d+)?)\s*(gb|tb)\s*(ssd|hdd)\b/gi),
  ).reduce((groups, match) => {
    const type = String(match[3] || "").toUpperCase();
    const label = `${match[1]}${String(match[2] || "").toUpperCase()} ${type}`;
    const key = label.toLowerCase();
    const current = groups.get(type) || new Map();
    current.set(key, label);
    groups.set(type, current);
    return groups;
  }, new Map());

  for (const [type, valuesMap] of storageMatches.entries()) {
    const values = Array.from(valuesMap.values());
    if (values.length > 1) {
      warnings.push({
        type: "storage",
        message: `Multiple ${type} storage options selected: ${values.join(", ")}. Keep only the required ${type} option.`,
      });
    }
  }

  return warnings;
};

export const buildSpecificationAssistFromText = (text = "", categories = [], templates = []) => {
  const sourceText = String(text || "");
  const matchedTemplates = getActiveTemplates(templates)
    .map((profile) => ({
      profile,
      score:
        getKeywordScore(sourceText, profile.keywords) +
        getKeywordScore(sourceText, profile.category_hints) / 2 +
        getKeywordScore(sourceText, profile.subcategory_hints) / 2,
    }))
    .filter((entry) => entry.score > 0)
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      return Number(first.profile.sort_order || 100) - Number(second.profile.sort_order || 100);
    })
    .map((entry) => entry.profile);

  const templateSuggestions = matchedTemplates.flatMap((profile) =>
    (profile.groups || []).flatMap((group) =>
      (group.suggestions || []).filter((suggestion) =>
        normalizeSmartText(sourceText).includes(normalizeSmartText(suggestion)),
      ),
    ),
  );

  const categorySuggestions = (categories || [])
    .flatMap((category) => [
      category?.category_name,
      ...(category?.subcategories || []).map((subcategory) => subcategory?.subcategory_name),
    ])
    .filter((value) => value && normalizeSmartText(sourceText).includes(normalizeSmartText(value)));

  return {
    matchedTemplates: matchedTemplates.map((template) => template.template_name),
    suggestions: uniqueSuggestions([
      ...extractSpecificationParts(sourceText),
      ...templateSuggestions,
      ...categorySuggestions,
    ]),
  };
};

export const mergeSpecificationParts = (currentSpecification = "", parts = []) => {
  const current = String(currentSpecification || "").trim();
  const nextParts = parts.filter(
    (part) =>
      part &&
      !current.toLowerCase().includes(String(part).toLowerCase()),
  );
  if (!current) return nextParts.join(", ");
  if (!nextParts.length) return current;
  return `${current}, ${nextParts.join(", ")}`;
};

export const buildSmartFillPatch = (item, categories = [], templates = []) => {
  const sourceText = [getItemCategoryContext(item, categories), item.specification]
    .filter(Boolean)
    .join(" ");
  const profile = getMatchedSpecificationProfile(item, categories, templates);

  if (!profile) return null;

  const category = item.category_id
    ? categories.find((entry) => String(entry.id) === String(item.category_id))
    : findCategoryByHints(categories, profile.category_hints);
  const subcategory = item.subcategory_id
    ? (category?.subcategories || []).find(
        (entry) => String(entry.id) === String(item.subcategory_id),
      )
    : findSubcategoryByHints(category, profile.subcategory_hints);
  const extractedParts = extractSpecificationParts(sourceText);

  return {
    category_id: category?.id ? String(category.id) : item.category_id,
    subcategory_id: subcategory?.id ? String(subcategory.id) : item.subcategory_id,
    item_name:
      !item.item_name || item.item_name.length > 70
        ? profile.item_name
        : item.item_name,
    specificationParts: extractedParts,
    profileTitle: profile.template_name,
  };
};
