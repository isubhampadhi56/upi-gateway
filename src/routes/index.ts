import { Router } from "express";
import { getCreatePage, createPaymentLink, getPayPage, getPaymentStatus, updatePayment } from "../controllers/paymentController";

const router = Router();

router.get("/create", getCreatePage);
router.post("/create", createPaymentLink);
router.get("/pay/:id", getPayPage);
router.get("/status/:id", getPaymentStatus);
router.post("/updatePayment", updatePayment);

export default router;
