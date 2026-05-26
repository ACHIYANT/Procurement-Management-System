export const isBlank = (value) =>
  value === undefined || value === null || String(value).trim() === "";

export const buildRequiredErrors = (form, fields) =>
  fields.reduce((errors, field) => {
    if (isBlank(form[field.name])) {
      errors[field.name] = field.message || `${field.label || "This field"} is required.`;
    }
    return errors;
  }, {});

export const hasErrors = (errors) => Object.keys(errors || {}).length > 0;

export const clearFieldError = (setErrors, field) => {
  setErrors((current) => {
    if (!current?.[field]) return current;
    const next = { ...current };
    delete next[field];
    return next;
  });
};

export const invalidControlClass = (hasError) =>
  hasError
    ? "border-red-400 bg-red-50/60 focus:border-red-500 focus:ring-red-100"
    : "";
