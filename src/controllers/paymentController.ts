import { Request, Response } from "express";
import { createHmac } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { paymentLinkRepo } from "../config/database";
import { PaymentLink, TransactionStatus } from "../models/PaymentLink";
import { renderPayPage } from "../views/payView";
import { renderCreatePage } from "../views/createView";
import { generateDeeplinks } from "../utils/deeplinkGen";
import { isIPAllowed } from "../utils/ipMatch";



export function getCreatePage(_req: Request, res: Response) {
  res.send(renderCreatePage());
}

export async function createPaymentLink(req: Request, res: Response) {
  try {
    const { intentURL, allowedIP, callbackUrl, orderId, timeout } = req.body;

    if (!intentURL || !allowedIP) {
      res.status(400).json({ error: "intentURL and allowedIP are required" });
      return;
    }

    const id = uuidv4();
    const createdAt = new Date();
    const timeoutMs = timeout && Number(timeout) > 0
      ? Number(timeout) * 1000
      : 24 * 60 * 60 * 1000; // default 24 hours
    const expireAt = new Date(createdAt.getTime() + timeoutMs);

    const link = paymentLinkRepo.create({
      id, intentURL, allowedIP, createdAt, expireAt,
      callbackUrl: callbackUrl ? JSON.stringify(callbackUrl) : null,
      orderId: orderId || null,
    });
    await paymentLinkRepo.save(link);

    res.status(201).json({ id, url: `/pay/${id}` });
  } catch (error) {
    console.error("Error creating payment link:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getPayPage(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const link = await paymentLinkRepo.findOneBy({ id });

    if (!link) {
      res.status(404).send("Payment link not found");
      return;
    }

    // Check if link has expired
    if (new Date() > new Date(link.expireAt)) {
      res.status(410).send("This payment link has expired");
      return;
    }

    // Get client IP
    const clientIP =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";

    // Normalize IPv6-mapped IPv4 and loopback addresses
    let normalizedIP = clientIP;
    if (normalizedIP === "::1") {
      normalizedIP = "127.0.0.1";
    } else if (normalizedIP.startsWith("::ffff:")) {
      normalizedIP = normalizedIP.slice(7);
    }

    // Check if client IP is in the comma-separated allowed list
    const allowedIPs = link.allowedIP.split(",").map((ip) => ip.trim());

    if (!isIPAllowed(normalizedIP, allowedIPs)) {
      res.status(403).send("Access denied: your IP is not allowed");
      return;
    }

    const deeplinks = await generateDeeplinks(link.intentURL, [
      "gpay", "phonepe", "paytm", "cred", "bhim",
    ]);

    // Record first click info
    if (!link.clickedAt) {
      const userAgent = req.headers["user-agent"] || "unknown";
      link.clickedAt = new Date();
      link.clickedBy = `${normalizedIP} | ${userAgent}`;
      await paymentLinkRepo.save(link);
    }

    const html = await renderPayPage(link.intentURL, deeplinks, id, new Date(link.expireAt).toISOString());
    res.send(html);
  } catch (error) {
    console.error("Error fetching payment page:", error);
    res.status(500).send("Internal server error");
  }
}

export async function getPaymentStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const link = await paymentLinkRepo.findOneBy({ id });

    if (!link) {
      res.status(404).json({ error: "Payment link not found" });
      return;
    }

    const callbacks = link.callbackUrl ? JSON.parse(link.callbackUrl) : null;

    // Append status and orderId as query params to callback URLs
    const appendParams = (url: string | null, includeError: boolean): string | null => {
      if (!url) return null;
      const separator = url.includes("?") ? "&" : "?";
      const params = [`status=${link.status}`];
      if (link.orderId) params.push(`orderId=${encodeURIComponent(link.orderId)}`);
      if (includeError && link.errorMessage) params.push(`errMsg=${encodeURIComponent(link.errorMessage)}`);
      return `${url}${separator}${params.join("&")}`;
    };

    res.json({
      status: link.status,
      orderId: link.orderId || null,
      expireAt: link.expireAt,
      successCallbackUrl: appendParams(callbacks?.successCallbackUrl || null, false),
      failureCallbackUrl: appendParams(callbacks?.failureCallbackUrl || null, true),
      pendingCallbackUrl: appendParams(callbacks?.pendingCallbackUrl || null, false),
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updatePayment(req: Request, res: Response) {
  try {
    const checksum = req.headers["x-checksum"] as string;

    if (!checksum) {
      res.status(400).json({ error: "x-checksum header is required" });
      return;
    }

    // Verify checksum: HMAC-SHA256 of raw body using WEBHOOK_SECRET
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      console.error("WEBHOOK_SECRET not configured");
      res.status(500).json({ error: "Server configuration error" });
      return;
    }

    const payload = JSON.stringify(req.body);
    const expectedChecksum = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (checksum !== expectedChecksum) {
      res.status(401).json({ error: "Invalid checksum" });
      return;
    }

    const { id, status, errorMessage } = req.body;

    if (!id || !status) {
      res.status(400).json({ error: "id and status are required" });
      return;
    }

    if (!Object.values(TransactionStatus).includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${Object.values(TransactionStatus).join(", ")}` });
      return;
    }

    const link = await paymentLinkRepo.findOneBy({ id });

    if (!link) {
      res.status(404).json({ error: "Payment link not found" });
      return;
    }

    link.status = status;
    if (errorMessage) link.errorMessage = errorMessage;
    await paymentLinkRepo.save(link);

    res.json({ message: "Payment status updated", id, status });
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
