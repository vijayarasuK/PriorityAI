require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

// 1. Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Supabase & Gemini Setup
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Deterministic Mathematical Priority (PS 50 Formula)
function calculateDeterministicPriority(safety, financial, downtime) {
  const rawScore = (safety * 0.40) + (financial * 0.35) + (downtime * 0.25);
  const ipiScore = Math.round(rawScore * 10 * 100) / 100;

  let priority = 'Low';
  let slaHours = 48;

  if (ipiScore >= 80) {
    priority = 'Critical';
    slaHours = 2;
  } else if (ipiScore >= 60) {
    priority = 'High';
    slaHours = 6;
  } else if (ipiScore >= 35) {
    priority = 'Medium';
    slaHours = 24;
  }

  return { ipiScore, priority, slaHours };
}

// 3. API: Submit Grievance (Customer Portal)
app.post('/api/complaints', upload.single('proof_image'), async (req, res) => {
  let uploadedFilePath = null;
  try {
    const { customer_id, customer_name, order_id, description } = req.body;
    console.log(`[INGEST] Grievance received: "${description}" from ${customer_name}`);

    let imageUrl = null;
    if (req.file) {
      uploadedFilePath = req.file.path;
      try {
        const uploadRes = await cloudinary.uploader.upload(req.file.path);
        imageUrl = uploadRes.secure_url;
      } catch (cloudErr) {
        console.warn('[Cloudinary Warning]:', cloudErr.message);
      }
    }

    let parsed = {
      category: "Payments/Billing",
      safety_hazard: 3,
      financial_risk: 8,
      downtime_urgency: 7,
      department: "Finance"
    };

    try {
      const prompt = `You are an incident priority AI. Analyze this grievance:
Description: "${description}"
Order / Asset ID: "${order_id || 'N/A'}"

Return ONLY a valid JSON object:
{
  "category": "Payments/Billing" | "Delivery/Logistics" | "Technical" | "Product Quality" | "General",
  "safety_hazard": 3,
  "financial_risk": 8,
  "downtime_urgency": 7,
  "department": "Finance" | "Logistics" | "IT Support" | "Product Team" | "Customer Care"
}`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt
      });

      const cleanJson = aiResponse.text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (aiErr) {
      console.warn('[Gemini fallback engaged]:', aiErr.message);
      const lower = (description || '').toLowerCase();
      if (lower.includes('payment') || lower.includes('money') || lower.includes('bill')) {
        parsed.category = 'Payments/Billing';
        parsed.financial_risk = 9;
        parsed.department = 'Finance';
      } else if (lower.includes('smoke') || lower.includes('fire') || lower.includes('hazard')) {
        parsed.safety_hazard = 10;
        parsed.department = 'Technical';
      }
    }

    const { ipiScore, priority, slaHours } = calculateDeterministicPriority(
      Number(parsed.safety_hazard) || 3,
      Number(parsed.financial_risk) || 7,
      Number(parsed.downtime_urgency) || 5
    );

    const now = new Date();
    const deadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000);
    const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;

    const newTicket = {
      ticket_id: ticketId,
      customer_id: customer_id || 'CUST-100',
      customer_name: customer_name || 'Anonymous Customer',
      description: description || 'No description provided',
      image_url: imageUrl,
      category: parsed.category || 'General',
      severity: Math.min(5, Math.max(1, Math.round(ipiScore / 20))),
      priority: priority,
      customer_impact: ipiScore >= 60 ? 'High' : (ipiScore >= 35 ? 'Medium' : 'Low'),
      department: parsed.department || 'Customer Care',
      sla_duration_hours: slaHours,
      created_at: now.toISOString(),
      sla_deadline: deadline.toISOString(),
      status: 'Open',
      escalation_level: ipiScore >= 80 ? 2 : 1,
      is_escalated: ipiScore >= 80
    };

    const { data, error } = await supabase.from('complaints').insert([newTicket]).select();
    if (error) {
      console.error('[Supabase Insert Error]:', error);
      throw error;
    }

    console.log(`[SUCCESS] Ticket ${ticketId} created | Priority: ${priority} (${ipiScore})`);
    res.json({
      success: true,
      ticket: data[0],
      ipi_score: ipiScore
    });
  } catch (err) {
    console.error('[Fatal Submission Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch (e) {}
    }
  }
});

// 4. API: Fetch All Complaints
app.get('/api/complaints', async (req, res) => {
  try {
    const { data, error } = await supabase.from('complaints').select('*').order('id', { ascending: false });
    if (error) throw error;

    const now = Date.now();
    const enriched = (data || []).map(ticket => {
      const created = new Date(ticket.created_at).getTime();
      const deadline = new Date(ticket.sla_deadline).getTime();
      const totalDuration = Math.max(1, deadline - created);
      const timeLeft = deadline - now;
      
      const timeRemainingRatio = Math.max(0, timeLeft / totalDuration);
      const urgencyScore = (0.6 * (1 - timeRemainingRatio)) + (0.4 * (ticket.severity / 5));

      const isBreachingSoon = timeLeft > 0 && timeLeft < (0.2 * totalDuration);
      const isBreached = timeLeft <= 0;

      return {
        ...ticket,
        time_left_minutes: Math.round(timeLeft / (1000 * 60)),
        urgency_score: parseFloat(urgencyScore.toFixed(2)),
        is_breaching_soon: isBreachingSoon,
        is_breached: isBreached,
        effective_escalation: isBreached ? 3 : (ticket.is_escalated ? 2 : ticket.escalation_level)
      };
    });

    enriched.sort((a, b) => b.urgency_score - a.urgency_score);
    res.json({ success: true, tickets: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. API: Unified Update / Resolve with SHA-256 State Signature
app.patch('/api/complaints/:ticket_id', async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const { status, escalation_level, is_escalated, resolution_notes, agent_name } = req.body;

    const updates = {};
    if (status) updates.status = status;
    if (escalation_level !== undefined) updates.escalation_level = escalation_level;
    if (is_escalated !== undefined) updates.is_escalated = is_escalated;

    if (status === 'Resolved') {
      const rawPayload = `${ticket_id}:${agent_name || 'Agent'}:${resolution_notes || 'Fixed'}:${Date.now()}`;
      updates.closure_hash = crypto.createHash('sha256').update(rawPayload).digest('hex');
    }

    const { data, error } = await supabase
      .from('complaints')
      .update(updates)
      .eq('ticket_id', ticket_id)
      .select();

    if (error) throw error;
    res.json({ success: true, ticket: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. API: Gemini Copilot Chat (Using gemini-3.6-flash)
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    let reply = "Hello! PriorityAI automatically triages incoming incidents using our mathematical SLA risk engine. Submit your incident through the intake portal above!";

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `You are the PriorityAI Copilot. User asks: "${message}". Give a short 2-sentence response explaining our automated SLA priority.`
      });
      reply = response.text.trim();
    } catch (aiChatErr) {
      if (message.toLowerCase().includes('hey') || message.toLowerCase().includes('hi')) {
        reply = "Hello! I am the PriorityAI Copilot. How can I assist you with your incident or SLA tracking today?";
      }
    }

    res.json({ success: true, reply });
  } catch (err) {
    res.json({ success: true, reply: "Hello! Our triage copilot is online. Feel free to submit your incident directly in the portal!" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PriorityAI Server running on http://0.0.0.0:${PORT}`);
});