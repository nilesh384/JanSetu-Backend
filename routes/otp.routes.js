import { Router } from "express";
import { sendOTPController, verifyOTPController, sendTestOTPController, getStoredOTPsController, verifyPhoneEmailController } from "../controllers/otp.controllers.js";

const router = Router();

// Send OTP to any phone number (Twilio method)
router.post("/send", sendOTPController);

// Verify OTP (Twilio method)
router.post("/verify", verifyOTPController);

// Verify phone.email JWT (Free method - alternative to Twilio)
router.post("/verify-phone-email", verifyPhoneEmailController);

// Send test OTP to your verified number (for testing)
router.post("/send-test", sendTestOTPController);

// Debug endpoint to see stored OTPs
router.get("/debug", getStoredOTPsController);

export default router;