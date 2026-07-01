import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const OPENWA_API_URL = process.env.OPENWA_API_URL || 'http://localhost:2785/api';
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || 'dgaebaa_dajAYckcalcaeu';
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID || 'default';

/**
 * Resolves the configured session ID (which can be a name like 'default') to its database UUID.
 * @returns {Promise<string>} The resolved session UUID.
 */
const resolveSessionId = async () => {
    let resolvedSessionId = OPENWA_SESSION_ID;
    try {
        const sessionsResponse = await axios.get(
            `${OPENWA_API_URL}/sessions`,
            {
                headers: {
                    'Accept': 'application/json',
                    'X-API-Key': OPENWA_API_KEY
                }
            }
        );
        const sessions = sessionsResponse.data;
        if (Array.isArray(sessions)) {
            const foundSession = sessions.find(s => s.name === OPENWA_SESSION_ID || s.id === OPENWA_SESSION_ID);
            if (foundSession) {
                resolvedSessionId = foundSession.id;
            }
        }
    } catch (resolveError) {
        console.warn('⚠️ [whatsappService] Failed to resolve session UUID by name, falling back to config value:', resolveError.message);
    }
    return resolvedSessionId;
};

/**
 * Normalizes phone number format for WhatsApp.
 * @param {string} phoneNumber 
 * @returns {string} chatId
 */
const getChatId = (phoneNumber) => {
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
    }
    return `${cleanPhone}@c.us`;
};

/**
 * Sends a WhatsApp text message via local OpenWA gateway.
 * @param {string} phoneNumber - Recipient's phone number
 * @param {string} text - Message text
 * @returns {Promise<boolean>} Success status
 */
export const sendWhatsAppMessage = async (phoneNumber, text) => {
    try {
        if (!phoneNumber) {
            console.error('❌ [whatsappService] Cannot send WhatsApp message: Phone number is empty');
            return false;
        }

        const chatId = getChatId(phoneNumber);
        const resolvedSessionId = await resolveSessionId();

        console.log(`📱 [whatsappService] Sending message to ${chatId} via OpenWA (Session ID: ${resolvedSessionId})...`);

        const response = await axios.post(
            `${OPENWA_API_URL}/sessions/${resolvedSessionId}/messages/send-text`,
            {
                chatId: chatId,
                text: text
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': OPENWA_API_KEY
                }
            }
        );

        console.log('✅ [whatsappService] WhatsApp message sent successfully:', response.data);
        return true;
    } catch (error) {
        console.error('❌ [whatsappService] Error sending WhatsApp message:', error.response?.data || error.message);
        return false;
    }
};

/**
 * Sends a WhatsApp image message via local OpenWA gateway.
 * @param {string} phoneNumber - Recipient's phone number
 * @param {string} imageUrl - Direct public HTTP/HTTPS URL of the image
 * @param {string} [caption] - Optional caption for the image
 * @returns {Promise<boolean>} Success status
 */
export const sendWhatsAppImage = async (phoneNumber, imageUrl, caption) => {
    try {
        if (!phoneNumber || !imageUrl) {
            console.error('❌ [whatsappService] Cannot send WhatsApp image: Phone number or image URL is empty');
            return false;
        }

        const chatId = getChatId(phoneNumber);
        const resolvedSessionId = await resolveSessionId();

        console.log(`🖼️ [whatsappService] Sending image to ${chatId} via OpenWA (Session ID: ${resolvedSessionId})...`);

        const response = await axios.post(
            `${OPENWA_API_URL}/sessions/${resolvedSessionId}/messages/send-image`,
            {
                chatId: chatId,
                url: imageUrl,
                caption: caption
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': OPENWA_API_KEY
                }
            }
        );

        console.log('✅ [whatsappService] WhatsApp image sent successfully:', response.data);
        return true;
    } catch (error) {
        console.error('❌ [whatsappService] Error sending WhatsApp image:', error.response?.data || error.message);
        return false;
    }
};
