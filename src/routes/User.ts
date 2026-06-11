import express from "express";
import { MeUser, createUser,resetPassword, VerifyEmailToken, getUsersByCompany, updateUserProfile } from "../modules/User/User";
import authenticate from "../modules/config/authenticate";
import { loginUserService,changePasswordService, forgotPasswordService, handleContactServiceMail } from "../services/auth/auth.service";
import { processResumeData } from "../config/common/resumeProcessor";
const router = express.Router();

router.post("/create", createUser);
router.post('/login', loginUserService)
router.post('/me',authenticate,MeUser)
router.post('/forgot-password',forgotPasswordService)
router.put('/',authenticate,updateUserProfile)
router.post('/contact/mail',handleContactServiceMail)
router.post('/reset-password',resetPassword)
router.post('/change-password',authenticate,changePasswordService)
router.get('/verify-email/:token',VerifyEmailToken)
router.post('/get/users',authenticate,getUsersByCompany)
router.post('/processResume',processResumeData)
export default router;