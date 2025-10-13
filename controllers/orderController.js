import razorpay from './razorpayInstance.js';
import { v4 as uuidv4 } from 'uuid';

export const createOrder = async (req, res) => {
  try {
    const {
      amount,
      currency,
      receipt,
      expire_in_minutes // Optional expiration field from client
    } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const order_id = uuidv4(); // Optional: use if you want to create your own receipt

    // Calculate expiry timestamp (Unix timestamp in seconds)
    const expireIn = expire_in_minutes || 15; // Default to 15 minutes
    const expireBy = Math.floor(Date.now() / 1000) + (expireIn * 60);

    const orderOptions = {
      amount: amount * 100, // Razorpay accepts amount in paise
      currency: currency || "INR",
      receipt: receipt || `receipt_${order_id}`,
      expire_by: expireBy
    };

    const order = await razorpay.orders.create(orderOptions);

    return res.status(201).json({
      message: "Order created successfully",
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      receipt: order.receipt,
      expire_by: order.expire_by,
      created_at: order.created_at
    });

  } catch (error) {
    console.error("Razorpay Order Error:", error);
    return res.status(500).json({ error: "Failed to create Razorpay order" });
  }
};
