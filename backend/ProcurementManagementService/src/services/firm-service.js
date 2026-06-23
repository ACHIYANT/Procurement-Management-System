const FirmRepository = require("../repository/firm-repository");
const {
  buildCursorResponse,
  isCursorMode,
  normalizeCursor,
  normalizeLimit,
  normalizeSortBy,
  normalizeSortDirection,
} = require("../utils/procurement-domain");

const FIRM_SORT_FIELDS = [
  "id",
  "firm_name",
  "firm_code",
  "vendor_category",
  "vendor_type",
  "gst_no",
  "pan_no",
];

class FirmService {
  constructor() {
    this.repository = new FirmRepository();
  }

  normalizeText(value) {
    const trimmed = String(value || "").trim().replace(/\s+/g, " ");
    return trimmed || undefined;
  }

  normalizeNullableText(value) {
    return this.normalizeText(value) || null;
  }

  normalizePan(value) {
    const pan = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!pan) return null;
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      const error = new Error("PAN number must be in valid format, e.g. ABCDE1234F.");
      error.statusCode = 400;
      throw error;
    }
    return pan;
  }

  normalizeGst(value) {
    const gst = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!gst) return null;
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)) {
      const error = new Error("GST number must be in valid 15-character GSTIN format.");
      error.statusCode = 400;
      throw error;
    }
    return gst;
  }

  assertPanMatchesGst(panNo, gstNo) {
    if (!panNo || !gstNo) return;
    const gstPan = gstNo.slice(2, 12);
    if (gstPan !== panNo) {
      const error = new Error("PAN number does not match the PAN embedded in GST number.");
      error.statusCode = 400;
      throw error;
    }
  }

  normalizeContactValue(contactType, value) {
    const type = this.normalizeText(contactType)?.toLowerCase() || "mobile";
    const text = this.normalizeText(value);
    if (!text) return "";
    if (["mobile", "phone", "whatsapp"].includes(type)) {
      const digits = text.replace(/\D/g, "");
      const mobile = digits.length > 10 ? digits.slice(-10) : digits;
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        const error = new Error("Mobile number must be a valid 10-digit Indian mobile number.");
        error.statusCode = 400;
        throw error;
      }
      return mobile;
    }
    if (type === "email") {
      const email = text.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const error = new Error("Email address is invalid.");
        error.statusCode = 400;
        throw error;
      }
      return email;
    }
    return text;
  }

  normalizePinCode(value) {
    const pin = String(value || "").trim().replace(/\D/g, "");
    if (!pin) return null;
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      const error = new Error("PIN code must be a valid 6-digit Indian PIN code.");
      error.statusCode = 400;
      throw error;
    }
    return pin;
  }

  normalizeFirmAddresses(items = []) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        address_type: this.normalizeText(item?.address_type) || "office",
        address_line_1: this.normalizeText(item?.address_line_1),
        address_line_2: this.normalizeNullableText(item?.address_line_2),
        district: this.normalizeNullableText(item?.district),
        city: this.normalizeText(item?.city),
        state: this.normalizeText(item?.state),
        country: this.normalizeText(item?.country) || "India",
        pin_code: this.normalizePinCode(item?.pin_code),
        landmark: this.normalizeNullableText(item?.landmark),
        is_primary: Boolean(item?.is_primary),
      }))
      .filter((item) => item.address_line_1 && item.city && item.state)
      .map((item, index, list) => ({
        ...item,
        is_primary: list.some((entry) => entry.is_primary) ? item.is_primary : index === 0,
      }));
  }

  normalizeFirmContacts(items = []) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        contact_person_name: this.normalizeText(item?.contact_person_name),
        designation: this.normalizeNullableText(item?.designation),
        contact_type: this.normalizeText(item?.contact_type) || "mobile",
        contact_value: this.normalizeContactValue(
          item?.contact_type || "mobile",
          item?.contact_value,
        ),
        is_primary: Boolean(item?.is_primary),
        remarks: this.normalizeNullableText(item?.remarks),
      }))
      .filter((item) => item.contact_person_name && item.contact_value)
      .map((item, index, list) => ({
        ...item,
        is_primary: list.some((entry) => entry.is_primary) ? item.is_primary : index === 0,
      }));
  }

  decorateFirm(firm) {
    if (!firm) return firm;

    const addresses = Array.isArray(firm.addresses) ? firm.addresses : [];
    const contacts = Array.isArray(firm.contacts) ? firm.contacts : [];
    const primaryAddress = addresses.find((item) => item?.is_primary) || addresses[0] || null;
    const primaryContact = contacts.find((item) => item?.is_primary) || contacts[0] || null;

    firm.dataValues.primary_address_label = primaryAddress
      ? [primaryAddress.city, primaryAddress.state].filter(Boolean).join(", ")
      : null;
    firm.dataValues.primary_contact_person = primaryContact?.contact_person_name || null;
    firm.dataValues.primary_contact_value = primaryContact?.contact_value || null;
    firm.dataValues.address_count = addresses.length;
    firm.dataValues.contact_count = contacts.length;

    return firm;
  }

  generateFirmCode() {
    return `FRM-${Date.now().toString(36).toUpperCase()}`;
  }

  buildSearchWhere(search) {
    if (!search) return {};
    return {
      $or: [
        { firm_name: { $like: `%${search}%` } },
        { firm_code: { $like: `%${search}%` } },
        { vendor_category: { $like: `%${search}%` } },
        { vendor_type: { $like: `%${search}%` } },
        { gst_no: { $like: `%${search}%` } },
        { pan_no: { $like: `%${search}%` } },
      ],
    };
  }

  validateCreatePayload(payload = {}) {
    const firmName = this.normalizeText(payload.firm_name);
    if (!firmName) {
      const error = new Error("Firm name is required.");
      error.statusCode = 400;
      throw error;
    }

    const panNo = this.normalizePan(payload.pan_no);
    const gstNo = this.normalizeGst(payload.gst_no);
    this.assertPanMatchesGst(panNo, gstNo);
    const contacts = this.normalizeFirmContacts(payload.contacts);
    const seenContacts = new Set();
    for (const contact of contacts) {
      const key = `${contact.contact_type}:${contact.contact_value}`;
      if (seenContacts.has(key)) {
        const error = new Error(`Duplicate contact value "${contact.contact_value}" in the same firm.`);
        error.statusCode = 400;
        throw error;
      }
      seenContacts.add(key);
    }

    return {
      firm_code: this.normalizeText(payload.firm_code)?.toUpperCase() || this.generateFirmCode(),
      firm_name: firmName,
      vendor_category: this.normalizeText(payload.vendor_category) || "general",
      vendor_type: this.normalizeNullableText(payload.vendor_type),
      gst_no: gstNo,
      pan_no: panNo,
      msme_no: this.normalizeNullableText(payload.msme_no),
      msme_state: this.normalizeNullableText(payload.msme_state),
      is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
      remarks: this.normalizeNullableText(payload.remarks),
      addresses: this.normalizeFirmAddresses(payload.addresses),
      contacts,
    };
  }

  async list(query = {}) {
    const search = this.normalizeText(query.search);
    const where = search
      ? {
          [require("sequelize").Op.or]: [
            { firm_name: { [require("sequelize").Op.like]: `%${search}%` } },
            { firm_code: { [require("sequelize").Op.like]: `%${search}%` } },
            { vendor_category: { [require("sequelize").Op.like]: `%${search}%` } },
            { vendor_type: { [require("sequelize").Op.like]: `%${search}%` } },
            { gst_no: { [require("sequelize").Op.like]: `%${search}%` } },
            { pan_no: { [require("sequelize").Op.like]: `%${search}%` } },
          ],
        }
      : {};

    const cursorMode = isCursorMode(query);
    const limit = normalizeLimit(query.limit);
    const cursor = normalizeCursor(query.cursor);
    const sortBy = normalizeSortBy(query.sortBy || query.sort_by, FIRM_SORT_FIELDS, "id");
    const sortDirection = normalizeSortDirection(query.sortDir || query.sort_dir, "DESC");

    if (cursorMode) {
      const rows = await this.repository.list({
        where,
        limit: limit + 1,
        cursor,
        sortBy,
        sortDirection,
      });
      const response = buildCursorResponse(rows, limit, { sortBy, sortDirection });
      response.rows = response.rows.map((row) => this.decorateFirm(row));
      return response;
    }

    const firms = await this.repository.list({ where, limit: 100, sortBy, sortDirection });
    return firms.map((row) => this.decorateFirm(row));
  }

  async create(payload = {}) {
    const normalized = this.validateCreatePayload(payload);
    const identityConflict = await this.repository.findIdentityConflict({
      firmCode: normalized.firm_code,
      firmName: normalized.firm_name,
      gstNo: normalized.gst_no,
      panNo: normalized.pan_no,
    });
    if (identityConflict) {
      const error = new Error("A firm with the same name, code, PAN, or GST number already exists.");
      error.statusCode = 409;
      throw error;
    }
    const contactConflict = await this.repository.findContactConflict(
      normalized.contacts.map((contact) => contact.contact_value),
    );
    if (contactConflict) {
      const error = new Error("A firm contact with the same mobile/email already exists.");
      error.statusCode = 409;
      throw error;
    }

    const firm = await this.repository.withTransaction(async (transaction) => {
      const createdFirm = await this.repository.createFirm(
        {
          firm_code: normalized.firm_code,
          firm_name: normalized.firm_name,
          vendor_category: normalized.vendor_category,
          vendor_type: normalized.vendor_type,
          gst_no: normalized.gst_no,
          pan_no: normalized.pan_no,
          msme_no: normalized.msme_no,
          msme_state: normalized.msme_state,
          is_active: normalized.is_active,
          remarks: normalized.remarks,
        },
        { transaction },
      );

      if (normalized.addresses.length) {
        await this.repository.bulkCreateAddresses(
          normalized.addresses.map((item) => ({
            firm_id: createdFirm.id,
            ...item,
          })),
          { transaction },
        );
      }

      if (normalized.contacts.length) {
        await this.repository.bulkCreateContacts(
          normalized.contacts.map((item) => ({
            firm_id: createdFirm.id,
            ...item,
          })),
          { transaction },
        );
      }

      return createdFirm;
    });

    return this.decorateFirm(await this.repository.findByPk(firm.id));
  }
}

module.exports = FirmService;
