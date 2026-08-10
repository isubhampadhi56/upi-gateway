import request from "supertest";
import { createHmac } from "crypto";
import { AppDataSource, paymentLinkRepo } from "../config/database";
import app from "../app";
import { TransactionStatus } from "../models/PaymentLink";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "your-webhook-secret-here";

function generateChecksum(body: object): string {
  return createHmac("sha256", WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest("hex");
}

beforeAll(async () => {
  await AppDataSource.initialize();
});

afterAll(async () => {
  await AppDataSource.destroy();
});

describe("POST /create", () => {
  it("should create a payment link and return id + url", async () => {
    const res = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=test@upi&am=100", allowedIP: "127.0.0.1" })
      .expect("Content-Type", /json/)
      .expect(201);

    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("url");
    expect(res.body.url).toBe(`/pay/${res.body.id}`);
  });

  it("should return 400 if intentURL is missing", async () => {
    const res = await request(app)
      .post("/create")
      .send({ allowedIP: "127.0.0.1" })
      .expect(400);

    expect(res.body.error).toBe("intentURL and allowedIP are required");
  });

  it("should return 400 if allowedIP is missing", async () => {
    const res = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=test@upi" })
      .expect(400);

    expect(res.body.error).toBe("intentURL and allowedIP are required");
  });

  it("should store orderId when provided", async () => {
    const res = await request(app)
      .post("/create")
      .send({
        intentURL: "upi://pay?pa=order@upi",
        allowedIP: "127.0.0.1",
        orderId: "ORD-12345",
      })
      .expect(201);

    const link = await paymentLinkRepo.findOneBy({ id: res.body.id });
    expect(link!.orderId).toBe("ORD-12345");
  });

  it("should store callbackUrl when provided", async () => {
    const res = await request(app)
      .post("/create")
      .send({
        intentURL: "upi://pay?pa=cb@upi",
        allowedIP: "127.0.0.1",
        callbackUrl: {
          successCallbackUrl: "https://example.com/success",
          failureCallbackUrl: "https://example.com/failure",
        },
      })
      .expect(201);

    const link = await paymentLinkRepo.findOneBy({ id: res.body.id });
    const callbacks = JSON.parse(link!.callbackUrl!);
    expect(callbacks.successCallbackUrl).toBe("https://example.com/success");
    expect(callbacks.failureCallbackUrl).toBe("https://example.com/failure");
  });
});

describe("GET /pay/:id", () => {
  let linkId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=demo@upi&am=50", allowedIP: "127.0.0.1" });
    linkId = res.body.id;
  });

  it("should return HTML page with QR code for allowed IP", async () => {
    const res = await request(app)
      .get(`/pay/${linkId}`)
      .expect("Content-Type", /html/)
      .expect(200);

    expect(res.text).toContain("QR Code");
    expect(res.text).toContain("upi://pay?pa=demo@upi&am=50");
    expect(res.text).toContain("data:image/png;base64");
  });

  it("should return 404 for non-existent id", async () => {
    const res = await request(app)
      .get("/pay/non-existent-id")
      .expect(404);

    expect(res.text).toBe("Payment link not found");
  });

  it("should return 403 if client IP is not allowed", async () => {
    const createRes = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=blocked@upi", allowedIP: "192.168.1.100" });

    const res = await request(app)
      .get(`/pay/${createRes.body.id}`)
      .expect(403);

    expect(res.text).toBe("Access denied: your IP is not allowed");
  });

  it("should allow access when client IP is in comma-separated list", async () => {
    const createRes = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=multi@upi", allowedIP: "192.168.1.50, 127.0.0.1, 10.0.0.1" });

    const res = await request(app)
      .get(`/pay/${createRes.body.id}`)
      .expect(200);

    expect(res.text).toContain("QR Code");
  });

  it("should record clickedAt and clickedBy on first visit", async () => {
    const createRes = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=click@upi", allowedIP: "127.0.0.1" });

    const id = createRes.body.id;

    // Before visit
    let link = await paymentLinkRepo.findOneBy({ id });
    expect(link!.clickedAt).toBeNull();
    expect(link!.clickedBy).toBeNull();

    // First visit
    await request(app)
      .get(`/pay/${id}`)
      .set("User-Agent", "TestBrowser/1.0")
      .expect(200);

    // After visit
    link = await paymentLinkRepo.findOneBy({ id });
    expect(link!.clickedAt).not.toBeNull();
    expect(link!.clickedBy).toContain("127.0.0.1");
    expect(link!.clickedBy).toContain("TestBrowser/1.0");
  });

  it("should not overwrite clickedAt on subsequent visits", async () => {
    const createRes = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=repeat@upi", allowedIP: "127.0.0.1" });

    const id = createRes.body.id;

    // First visit
    await request(app).get(`/pay/${id}`).expect(200);
    const link = await paymentLinkRepo.findOneBy({ id });
    const firstClickedAt = link!.clickedAt;

    // Second visit
    await request(app).get(`/pay/${id}`).expect(200);
    const linkAfter = await paymentLinkRepo.findOneBy({ id });
    expect(linkAfter!.clickedAt!.getTime()).toBe(firstClickedAt!.getTime());
  });

  it("should return 410 for expired links", async () => {
    const createRes = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=expired@upi", allowedIP: "127.0.0.1" });

    const id = createRes.body.id;

    // Manually set expireAt to the past
    const link = await paymentLinkRepo.findOneBy({ id });
    link!.expireAt = new Date(Date.now() - 1000);
    await paymentLinkRepo.save(link!);

    const res = await request(app)
      .get(`/pay/${id}`)
      .expect(410);

    expect(res.text).toBe("This payment link has expired");
  });
});

describe("GET /status/:id", () => {
  it("should return pending status for new link", async () => {
    const createRes = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=status@upi", allowedIP: "127.0.0.1" });

    const res = await request(app)
      .get(`/status/${createRes.body.id}`)
      .expect(200);

    expect(res.body.status).toBe("pending");
    expect(res.body.orderId).toBeNull();
    expect(res.body.successCallbackUrl).toBeNull();
    expect(res.body.failureCallbackUrl).toBeNull();
  });

  it("should return 404 for non-existent id", async () => {
    const res = await request(app)
      .get("/status/non-existent-id")
      .expect(404);

    expect(res.body.error).toBe("Payment link not found");
  });

  it("should return callback URLs with status and orderId appended", async () => {
    const createRes = await request(app)
      .post("/create")
      .send({
        intentURL: "upi://pay?pa=cb-test@upi",
        allowedIP: "127.0.0.1",
        orderId: "ORD-999",
        callbackUrl: {
          successCallbackUrl: "https://example.com/success",
          failureCallbackUrl: "https://example.com/failure",
        },
      });

    const res = await request(app)
      .get(`/status/${createRes.body.id}`)
      .expect(200);

    expect(res.body.status).toBe("pending");
    expect(res.body.orderId).toBe("ORD-999");
    expect(res.body.successCallbackUrl).toBe("https://example.com/success?status=pending&orderId=ORD-999");
    expect(res.body.failureCallbackUrl).toBe("https://example.com/failure?status=pending&orderId=ORD-999");
  });

  it("should handle callback URLs that already have query params", async () => {
    const createRes = await request(app)
      .post("/create")
      .send({
        intentURL: "upi://pay?pa=qp@upi",
        allowedIP: "127.0.0.1",
        orderId: "ORD-QP",
        callbackUrl: {
          successCallbackUrl: "https://example.com/success?ref=abc",
          failureCallbackUrl: "https://example.com/failure?ref=abc",
        },
      });

    const res = await request(app)
      .get(`/status/${createRes.body.id}`)
      .expect(200);

    expect(res.body.successCallbackUrl).toBe("https://example.com/success?ref=abc&status=pending&orderId=ORD-QP");
    expect(res.body.failureCallbackUrl).toBe("https://example.com/failure?ref=abc&status=pending&orderId=ORD-QP");
  });
});

describe("POST /updatePayment", () => {
  let paymentId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=webhook@upi", allowedIP: "127.0.0.1", orderId: "ORD-WH" });
    paymentId = res.body.id;
  });

  it("should return 400 if x-checksum header is missing", async () => {
    const res = await request(app)
      .post("/updatePayment")
      .send({ id: paymentId, status: "success" })
      .expect(400);

    expect(res.body.error).toBe("x-checksum header is required");
  });

  it("should return 401 if checksum is invalid", async () => {
    const res = await request(app)
      .post("/updatePayment")
      .set("x-checksum", "invalid-checksum")
      .send({ id: paymentId, status: "success" })
      .expect(401);

    expect(res.body.error).toBe("Invalid checksum");
  });

  it("should update payment status with valid checksum", async () => {
    const body = { id: paymentId, status: "success" };
    const checksum = generateChecksum(body);

    const res = await request(app)
      .post("/updatePayment")
      .set("x-checksum", checksum)
      .send(body)
      .expect(200);

    expect(res.body.message).toBe("Payment status updated");
    expect(res.body.id).toBe(paymentId);
    expect(res.body.status).toBe("success");

    // Verify in DB
    const link = await paymentLinkRepo.findOneBy({ id: paymentId });
    expect(link!.status).toBe(TransactionStatus.SUCCESS);
  });

  it("should return 400 for invalid status value", async () => {
    const body = { id: paymentId, status: "invalid_status" };
    const checksum = generateChecksum(body);

    const res = await request(app)
      .post("/updatePayment")
      .set("x-checksum", checksum)
      .send(body)
      .expect(400);

    expect(res.body.error).toContain("Invalid status");
  });

  it("should return 400 if id is missing", async () => {
    const body = { status: "success" };
    const checksum = generateChecksum(body);

    const res = await request(app)
      .post("/updatePayment")
      .set("x-checksum", checksum)
      .send(body)
      .expect(400);

    expect(res.body.error).toBe("id and status are required");
  });

  it("should return 404 for non-existent payment id", async () => {
    const body = { id: "non-existent-id", status: "failure" };
    const checksum = generateChecksum(body);

    const res = await request(app)
      .post("/updatePayment")
      .set("x-checksum", checksum)
      .send(body)
      .expect(404);

    expect(res.body.error).toBe("Payment link not found");
  });

  it("should update status to failure", async () => {
    // Create a new link for this test
    const createRes = await request(app)
      .post("/create")
      .send({ intentURL: "upi://pay?pa=fail@upi", allowedIP: "127.0.0.1" });

    const body = { id: createRes.body.id, status: "failure" };
    const checksum = generateChecksum(body);

    const res = await request(app)
      .post("/updatePayment")
      .set("x-checksum", checksum)
      .send(body)
      .expect(200);

    expect(res.body.status).toBe("failure");

    const link = await paymentLinkRepo.findOneBy({ id: createRes.body.id });
    expect(link!.status).toBe(TransactionStatus.FAILURE);
  });
});

describe("GET /status/:id after updatePayment", () => {
  it("should reflect updated status in callback URLs", async () => {
    const createRes = await request(app)
      .post("/create")
      .send({
        intentURL: "upi://pay?pa=flow@upi",
        allowedIP: "127.0.0.1",
        orderId: "ORD-FLOW",
        callbackUrl: {
          successCallbackUrl: "https://example.com/done",
          failureCallbackUrl: "https://example.com/fail",
        },
      });

    const id = createRes.body.id;

    // Update to success
    const body = { id, status: "success" };
    const checksum = generateChecksum(body);
    await request(app)
      .post("/updatePayment")
      .set("x-checksum", checksum)
      .send(body)
      .expect(200);

    // Check status
    const res = await request(app)
      .get(`/status/${id}`)
      .expect(200);

    expect(res.body.status).toBe("success");
    expect(res.body.successCallbackUrl).toBe("https://example.com/done?status=success&orderId=ORD-FLOW");
    expect(res.body.failureCallbackUrl).toBe("https://example.com/fail?status=success&orderId=ORD-FLOW");
  });
});
