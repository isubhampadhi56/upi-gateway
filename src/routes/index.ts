import { Router } from "express";
import { getCreatePage, createPaymentLink, getPayPage, getPaymentStatus, updatePayment, getUpiAppsList } from "../controllers/paymentController";
import { validateBody } from "../middleware/validate";
import { createPaymentLinkSchema, updatePaymentSchema } from "../schemas/paymentSchemas";

const router = Router();

router.get("/create", getCreatePage);
router.post("/create", validateBody(createPaymentLinkSchema), createPaymentLink);
router.get("/pay/:id", getPayPage);
router.get("/status/:id", getPaymentStatus);
router.post("/updatePayment", updatePayment);
router.get("/upiAppsList", getUpiAppsList);

export default router;
