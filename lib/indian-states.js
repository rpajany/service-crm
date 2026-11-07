/**
 * GST state/UT codes used by Customer and future invoice forms.
 * Keep codes as strings so leading zeroes (for example "01") are preserved.
 * This list contains current Indian states and union territories only.
 */
export const INDIAN_STATES = [
  { value: "01", label: "Jammu and Kashmir" },
  { value: "02", label: "Himachal Pradesh" },
  { value: "03", label: "Punjab" },
  { value: "04", label: "Chandigarh" },
  { value: "05", label: "Uttarakhand" },
  { value: "06", label: "Haryana" },
  { value: "07", label: "Delhi" },
  { value: "08", label: "Rajasthan" },
  { value: "09", label: "Uttar Pradesh" },
  { value: "10", label: "Bihar" },
  { value: "11", label: "Sikkim" },
  { value: "12", label: "Arunachal Pradesh" },
  { value: "13", label: "Nagaland" },
  { value: "14", label: "Manipur" },
  { value: "15", label: "Mizoram" },
  { value: "16", label: "Tripura" },
  { value: "17", label: "Meghalaya" },
  { value: "18", label: "Assam" },
  { value: "19", label: "West Bengal" },
  { value: "20", label: "Jharkhand" },
  { value: "21", label: "Odisha" },
  { value: "22", label: "Chhattisgarh" },
  { value: "23", label: "Madhya Pradesh" },
  { value: "24", label: "Gujarat" },
  { value: "26", label: "Dadra and Nagar Haveli and Daman and Diu" },
  { value: "27", label: "Maharashtra" },
  { value: "29", label: "Karnataka" },
  { value: "30", label: "Goa" },
  { value: "31", label: "Lakshadweep" },
  { value: "32", label: "Kerala" },
  { value: "33", label: "Tamil Nadu" },
  { value: "34", label: "Puducherry" },
  { value: "35", label: "Andaman and Nicobar Islands" },
  { value: "36", label: "Telangana" },
  { value: "37", label: "Andhra Pradesh" },
  { value: "38", label: "Ladakh" }
];

// Special GST/e-way-bill values are intentionally separate from the State dropdown.
export const GST_SPECIAL_CODES = [
  { value: "97", label: "Other Territory" },
  { value: "99", label: "Other Country" }
];

// Convert a saved state name (legacy company records) or code into a GST code.
export function getIndianStateCode(value) {
  if (value == null || value === "") return "";
  const normalized = String(value).trim().toLowerCase();
  const match = INDIAN_STATES.find((state) =>
    state.value === normalized || state.label.toLowerCase() === normalized
  );
  return match?.value || "";
}

export function getIndianStateLabel(value) {
  if (value == null || value === "") return "";
  const normalized = String(value).trim().toLowerCase();
  const match = INDIAN_STATES.find((state) =>
    state.value === normalized || state.label.toLowerCase() === normalized
  );
  return match?.label || String(value);
}
