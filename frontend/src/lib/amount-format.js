const toNumber = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const trimZeroes = (value) =>
  String(value || "")
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");

export const formatCurrencyINR = (value, options = {}) =>
  toNumber(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  });

export const formatCompactIndianAmount = (value, options = {}) => {
  const amount = toNumber(value);
  const absolute = Math.abs(amount);
  const prefix = options.currency === false ? "" : "₹";
  const sign = amount < 0 ? "-" : "";
  const decimals = options.decimals ?? 2;

  if (absolute >= 10000000) {
    return `${sign}${prefix}${trimZeroes((absolute / 10000000).toFixed(decimals))} Cr`;
  }

  if (absolute >= 100000) {
    return `${sign}${prefix}${trimZeroes((absolute / 100000).toFixed(decimals))} Lakh`;
  }

  if (absolute >= 1000) {
    return `${sign}${prefix}${trimZeroes((absolute / 1000).toFixed(decimals))}K`;
  }

  return `${sign}${formatCurrencyINR(absolute, { maximumFractionDigits: 0 })}`;
};
