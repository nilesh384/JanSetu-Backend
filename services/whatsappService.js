import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v26.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const RESOLVED_TEMPLATE = process.env.WHATSAPP_RESOLVED_TEMPLATE || 'jansetu_report_resolved';
const IMAGE_TEMPLATE = process.env.WHATSAPP_IMAGE_TEMPLATE || 'jansetu_resolution_photo';
const TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';

const getRecipient = (phoneNumber) => {
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    // User records currently store Indian local numbers in some environments.
    const internationalNumber = digits.length === 10 ? `91${digits}` : digits;
    if (internationalNumber.length < 8 || internationalNumber.length > 15) {
        throw new Error('Recipient phone number must include a country code (10 digit Indian numbers are supported).');
    }
    return internationalNumber;
};

const getConfig = () => {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
        throw new Error('WhatsApp Cloud API is not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
    }
    return {
        url: `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    };
};

const send = async (payload, label) => {
    try {
        const config = getConfig();
        const response = await axios.post(config.url, payload, { headers: config.headers, timeout: 15000 });
        console.log(`[whatsappService] ${label} accepted by WhatsApp Cloud API:`, response.data?.messages?.[0]?.id || 'ok');
        return true;
    } catch (error) {
        console.error(`[whatsappService] ${label} failed:`, error.response?.data || error.message);
        return false;
    }
};

/** Send an approved utility template so report updates work outside the 24-hour service window. */
export const sendWhatsAppMessage = async (phoneNumber, text) => {
    if (!phoneNumber || !text) {
        console.error('[whatsappService] Recipient and message text are required.');
        return false;
    }

    let to;
    try {
        to = getRecipient(phoneNumber);
        getConfig();
    } catch (error) {
        console.error('[whatsappService] Cannot send message:', error.message);
        return false;
    }

    return send({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
            name: RESOLVED_TEMPLATE,
            language: { code: TEMPLATE_LANGUAGE },
            components: [{
                type: 'body',
                parameters: [{ type: 'text', text: String(text).slice(0, 1024) }],
            }],
        },
    }, 'Report update');
};

/** Send a resolution image with an approved media-header template (works outside the 24-hour window). */
export const sendWhatsAppImage = async (phoneNumber, imageUrl, caption = '') => {
    if (!phoneNumber || !imageUrl || !/^https:\/\//i.test(imageUrl)) {
        console.error('[whatsappService] Recipient and a public HTTPS image URL are required.');
        return false;
    }

    let to;
    try {
        to = getRecipient(phoneNumber);
        getConfig();
    } catch (error) {
        console.error('[whatsappService] Cannot send image:', error.message);
        return false;
    }

    return send({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
            name: IMAGE_TEMPLATE,
            language: { code: TEMPLATE_LANGUAGE },
            components: [
                { type: 'header', parameters: [{ type: 'image', image: { link: imageUrl } }] },
                { type: 'body', parameters: [{ type: 'text', text: String(caption || 'Resolution photo').slice(0, 1024) }] },
            ],
        },
    }, 'Resolution photo');
};
