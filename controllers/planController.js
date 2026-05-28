import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

const PLANS_TABLE = process.env.PLANS_TABLE || "plans";

const ALLOWED_TYPES = ["employer", "candidate"];

export const createPlan = async (req, res) => {
  try {
    const {
      plan_id,
      type,
      name,
      description = "",
      price,
      validity_days,
      popular = false,
      features = [],
    } = req.body;

    console.log(req.body , "<<<<<<<<<<<<<<<<<");

    if (!plan_id || !type || !name || price === undefined || !validity_days) {
      return res.status(400).json({
        error: "plan_id, type, name, price, and validity_days are required",
      });
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${ALLOWED_TYPES.join(", ")}`,
      });
    }

    const existing = await ddbDocClient.send(
      new GetCommand({
        TableName: PLANS_TABLE,
        Key: { plan_id },
      })
    );

    if (existing.Item) {
      return res.status(409).json({ error: "Plan with this plan_id already exists" });
    }

    const timestamp = new Date().toISOString();
    const plan = {
      plan_id,
      type,
      name,
      description,
      price: Number(price),
      validity_days: validity_days,
      popular: Boolean(popular),
      features: Array.isArray(features) ? features : [],
      created_at: timestamp,
      updated_at: timestamp,
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: PLANS_TABLE,
        Item: plan,
      })
    );

    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan,
    });
  } catch (err) {
    console.error("Create Plan Error:", err);
    return res.status(500).json({ error: "Failed to create plan" });
  }
};

export const getAllPlans = async (req, res) => {
  try {
    const { type } = req.query;

    const params = { TableName: PLANS_TABLE };

    if (type) {
      if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({
          error: `type must be one of: ${ALLOWED_TYPES.join(", ")}`,
        });
      }
      params.FilterExpression = "#type = :type";
      params.ExpressionAttributeNames = { "#type": "type" };
      params.ExpressionAttributeValues = { ":type": type };
    }

    const result = await ddbDocClient.send(new ScanCommand(params));
    const plans = (result.Items || []).sort(
      (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
    );

    return res.status(200).json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (err) {
    console.error("Get All Plans Error:", err);
    return res.status(500).json({ error: "Failed to fetch plans" });
  }
};

export const getPlanById = async (req, res) => {
  try {
    const { plan_id } = req.params;

    if (!plan_id) {
      return res.status(400).json({ error: "plan_id is required" });
    }

    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: PLANS_TABLE,
        Key: { plan_id },
      })
    );

    if (!result.Item) {
      return res.status(404).json({ error: "Plan not found" });
    }

    return res.status(200).json({
      success: true,
      plan: result.Item,
    });
  } catch (err) {
    console.error("Get Plan Error:", err);
    return res.status(500).json({ error: "Failed to fetch plan" });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const { plan_id } = req.params;
    const updates = { ...req.body };

    if (!plan_id) {
      return res.status(400).json({ error: "plan_id is required" });
    }

    delete updates.plan_id;
    delete updates.created_at;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    if (updates.type && !ALLOWED_TYPES.includes(updates.type)) {
      return res.status(400).json({
        error: `type must be one of: ${ALLOWED_TYPES.join(", ")}`,
      });
    }

    const existing = await ddbDocClient.send(
      new GetCommand({
        TableName: PLANS_TABLE,
        Key: { plan_id },
      })
    );

    if (!existing.Item) {
      return res.status(404).json({ error: "Plan not found" });
    }

    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.validity_days !== undefined) {
      updates.validity_days = updates.validity_days;
    }
    if (updates.popular !== undefined) updates.popular = Boolean(updates.popular);

    updates.updated_at = new Date().toISOString();

    const updateExpr = [];
    const exprAttrNames = {};
    const exprAttrValues = {};

    Object.keys(updates).forEach((key) => {
      updateExpr.push(`#${key} = :${key}`);
      exprAttrNames[`#${key}`] = key;
      exprAttrValues[`:${key}`] = updates[key];
    });

    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: PLANS_TABLE,
        Key: { plan_id },
        UpdateExpression: `SET ${updateExpr.join(", ")}`,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        ReturnValues: "ALL_NEW",
      })
    );

    return res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      plan: result.Attributes,
    });
  } catch (err) {
    console.error("Update Plan Error:", err);
    return res.status(500).json({ error: "Failed to update plan" });
  }
};

export const deletePlan = async (req, res) => {
  try {
    const { plan_id } = req.params;

    if (!plan_id) {
      return res.status(400).json({ error: "plan_id is required" });
    }

    const existing = await ddbDocClient.send(
      new GetCommand({
        TableName: PLANS_TABLE,
        Key: { plan_id },
      })
    );

    if (!existing.Item) {
      return res.status(404).json({ error: "Plan not found" });
    }

    await ddbDocClient.send(
      new DeleteCommand({
        TableName: PLANS_TABLE,
        Key: { plan_id },
      })
    );

    return res.status(200).json({
      success: true,
      message: "Plan deleted successfully",
      plan_id,
    });
  } catch (err) {
    console.error("Delete Plan Error:", err);
    return res.status(500).json({ error: "Failed to delete plan" });
  }
};
