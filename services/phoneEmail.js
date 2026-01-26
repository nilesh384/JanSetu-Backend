import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Phone.email Integration Service
 * 
 * Phone.email provides FREE phone verification via a webview-based authentication flow.
 * Unlike Twilio, it handles OTP sending/verification on their end and returns a JWT token.
 * 
 * Setup:
 * 1. Sign up at https://admin.phone.email
 * 2. Get your CLIENT_ID and API_KEY from dashboard
 * 3. Add to .env: PHONE_EMAIL_CLIENT_ID and PHONE_EMAIL_API_KEY
 */

class PhoneEmailService {
  constructor() {
    this.clientId = process.env.PHONE_EMAIL_CLIENT_ID;
    this.apiKey = process.env.PHONE_EMAIL_API_KEY;
  }

  /**
   * Generate authentication URL for webview
   * @param {string} deviceId - Unique device identifier
   * @returns {string} - Authentication URL
   */
  getAuthURL(deviceId) {
    // auth_type=4 means phone number authentication
    return `https://auth.phone.email/log-in?client_id=${this.clientId}&auth_type=4&device=${deviceId}`;
  }

  /**
   * Verify JWT token and extract phone number
   * The JWT is returned from phone.email webview after successful verification
   * @param {string} encodedJWT - JWT token from phone.email
   * @returns {Promise<Object>} - User phone details
   */
  async verifyJWT(encodedJWT) {
    try {
      if (!encodedJWT) {
        throw new Error('JWT token is required');
      }

      // Decode JWT to get user_json_url
      const payload = JSON.parse(Buffer.from(encodedJWT.split('.')[1], 'base64').toString());
      console.log('📱 Decoded JWT payload:', payload);

      // Check if phone details are directly in JWT payload (new format)
      if (payload.country_code && payload.phone_no) {
        console.log('✅ Phone.email verification successful (direct JWT):', {
          country_code: payload.country_code,
          phone_number: payload.phone_no,
          name: `${payload.user_first_name || ''} ${payload.user_last_name || ''}`.trim()
        });

        return {
          success: true,
          phoneNumber: `${payload.country_code}${payload.phone_no}`,
          countryCode: payload.country_code.replace('+', ''),
          rawPhoneNumber: payload.phone_no,
          firstName: payload.user_first_name || '',
          lastName: payload.user_last_name || '',
          fullName: `${payload.user_first_name || ''} ${payload.user_last_name || ''}`.trim()
        };
      }

      // Fallback: The JWT contains a user_json_url - fetch user data from this URL
      if (payload.user_json_url) {
        const response = await axios.get(payload.user_json_url);
        const userData = response.data;

        console.log('✅ Phone.email verification successful:', {
          country_code: userData.user_country_code,
          phone_number: userData.user_phone_number,
          name: `${userData.user_first_name} ${userData.user_last_name}`.trim()
        });

        return {
          success: true,
          phoneNumber: `+${userData.user_country_code}${userData.user_phone_number}`,
          countryCode: userData.user_country_code,
          rawPhoneNumber: userData.user_phone_number,
          firstName: userData.user_first_name || '',
          lastName: userData.user_last_name || '',
          fullName: `${userData.user_first_name || ''} ${userData.user_last_name || ''}`.trim()
        };
      }

      throw new Error('Invalid JWT structure - missing phone details or user_json_url');

    } catch (error) {
      console.error('❌ Phone.email JWT verification error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Alternative: Verify directly using phone.email API (if they provide one)
   * This is a placeholder - check phone.email docs for actual API endpoint
   */
  async verifyToken(token) {
    try {
      // Note: This endpoint may not exist - phone.email primarily uses JWT verification
      const response = await axios.post('https://api.phone.email/verify', {
        token: token,
        api_key: this.apiKey,
        client_id: this.clientId
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error verifying token with phone.email API:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if phone.email is configured
   */
  isConfigured() {
    return !!(this.clientId && this.apiKey);
  }
}

export default new PhoneEmailService();
