// Shared Campaigns Module — used by all 4 industry dashboards.
//
// Channels:  SMS (BulkSMS)  ·  Email (SendGrid)
//
// Email: plain-text and HTML modes, live preview (desktop + mobile),
// .html file upload, starter templates, merge-tag insertion, test send.
//
// "Send to" modes:
//   all     — every contact in the collection
//   tagged  — contacts whose tags[] overlap the selected tag set
//   custom  — contacts that pass ALL selected filter predicates (AND logic)
//
// marketingOptOut === true contacts are always excluded.
//
// Sending:
//   Send now      — quota-checked, iterates recipients, updates sentCount/sentAt,
//                   increments users/{uid}.messagesUsed via Firestore increment().
//   Schedule later — writes status:'Scheduled' + scheduledFor Timestamp;
//                   the Cloud Function processScheduledCampaigns fires every 5 min.

import { useState, useMemo, useRef, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import {
  addDoc, updateDoc, deleteDoc, doc,
  collection, serverTimestamp, increment, Timestamp,
  getDocs, query, where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../services/firebase'
import { sendMessage } from '../../services/messaging'
import EmailEditor from 'react-email-editor'
import Modal from './Modal'
import DataTable from './DataTable'
import {
  PlusCircle, Send, Users, Mail, Phone as PhoneIcon,
  CheckCircle, Loader2, Tag, Filter, X, Clock, AlertTriangle, Calendar,
  Upload, Eye, EyeOff, Monitor, Smartphone, Code, FileText, ChevronDown, ChevronRight, Star,
  MousePointer, TrendingUp, ArrowLeft, Layers, Copy, BookmarkPlus, Trash2, Save,
  Repeat, Pause, Play, CreditCard, Bookmark,
} from 'lucide-react'
import { PLANS } from '../../utils/industries'
import { shortenUrl } from '../../utils/shorten'

// ── Email templates ───────────────────────────────────────────────────────────
const EMAIL_TEMPLATES = [
  // ── General ──────────────────────────────────────────────────────────────
  {
    label: 'Announcement', category: 'general',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#5b8f7d;padding:32px 40px">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Your Business Name</h1>
  </div>
  <div style="padding:32px 40px">
    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px">Hello {name},</h2>
    <p style="margin:0 0 20px;color:#555;line-height:1.7;font-size:15px">Write your announcement here. Share news, updates, or important information with your contacts.</p>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Learn More</a>
  </div>
  <div style="padding:20px 40px;border-top:1px solid #eee;background:#fafafa">
    <p style="margin:0;color:#999;font-size:12px">You received this because you opted in. <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
  {
    label: 'Promotional', category: 'general',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#5b8f7d 0%,#3d6b5c 100%);padding:48px 40px;text-align:center">
    <h1 style="margin:0 0 8px;color:#fff;font-size:32px;font-weight:800">Special Offer</h1>
    <p style="margin:0;color:rgba(255,255,255,0.85);font-size:16px">Exclusive deal just for you, {name}</p>
  </div>
  <div style="background:#fff;padding:40px">
    <p style="margin:0 0 24px;color:#444;line-height:1.7;font-size:15px;text-align:center">Describe your promotion or offer here. Make it compelling and action-oriented.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px">Claim Offer</a>
    </div>
    <p style="margin:0;color:#999;font-size:12px;text-align:center">Offer valid for a limited time. Terms apply.</p>
  </div>
  <div style="padding:20px 40px;background:#f9f9f9;border-top:1px solid #eee">
    <p style="margin:0;color:#aaa;font-size:12px;text-align:center"><a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
  {
    label: 'Newsletter', category: 'general',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f3;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto">
  <div style="background:#fff;border-bottom:3px solid #5b8f7d;padding:24px 40px">
    <p style="margin:0;color:#5b8f7d;font-weight:800;font-size:18px;letter-spacing:0.05em">YOUR NEWSLETTER</p>
  </div>
  <div style="background:#fff;padding:32px 40px">
    <p style="margin:0 0 20px;color:#333;font-size:15px">Hi {name},</p>
    <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;font-weight:700">This Month's Update</h2>
    <p style="margin:0 0 24px;color:#555;line-height:1.7;font-size:15px">Share your news, tips, or stories here. Two or three sections work best.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <h3 style="margin:0 0 10px;color:#1a1a1a;font-size:17px">Second Story</h3>
    <p style="margin:0 0 20px;color:#555;line-height:1.7;font-size:15px">Add another update here to keep your audience engaged.</p>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Read More</a>
  </div>
  <div style="padding:20px 40px;background:#f0f4f3">
    <p style="margin:0;color:#aaa;font-size:12px;text-align:center">© 2026 · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
  {
    label: 'Win-Back', category: 'general',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="padding:48px 40px;text-align:center">
    <p style="margin:0 0 8px;font-size:40px">👋</p>
    <h1 style="margin:0 0 12px;color:#1a1a1a;font-size:26px;font-weight:800">We miss you, {name}!</h1>
    <p style="margin:0 0 28px;color:#555;line-height:1.7;font-size:15px">It's been a while since we last connected. We'd love to have you back and wanted to reach out personally.</p>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px">Come Back →</a>
  </div>
  <div style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px;text-align:center">Questions? Reply to this email. · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },

  // ── Medical ───────────────────────────────────────────────────────────────
  {
    label: 'Appointment Reminder', category: 'medical',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f7f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <div style="background:#5b8f7d;padding:28px 40px">
    <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;font-weight:600;letter-spacing:0.08em">APPOINTMENT REMINDER</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700">Your visit is coming up</h1>
  </div>
  <div style="padding:32px 40px">
    <p style="margin:0 0 20px;color:#333;font-size:15px">Hi {name},</p>
    <p style="margin:0 0 24px;color:#555;line-height:1.7;font-size:15px">This is a friendly reminder about your upcoming appointment. Please arrive 10 minutes early and bring your medical aid card if applicable.</p>
    <div style="background:#f0f7f5;border-left:4px solid #5b8f7d;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 28px">
      <p style="margin:0 0 4px;color:#5b8f7d;font-weight:700;font-size:13px">APPOINTMENT DETAILS</p>
      <p style="margin:0;color:#333;font-size:14px">📅 Date: <strong>[Date]</strong></p>
      <p style="margin:4px 0 0;color:#333;font-size:14px">🕐 Time: <strong>[Time]</strong></p>
      <p style="margin:4px 0 0;color:#333;font-size:14px">📍 Address: <strong>[Practice Address]</strong></p>
    </div>
    <p style="margin:0 0 20px;color:#555;font-size:14px">Need to reschedule? Please contact us at least 24 hours in advance.</p>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Confirm Appointment</a>
  </div>
  <div style="padding:20px 40px;background:#f9f9f9;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px">© 2026 Your Practice · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
  {
    label: 'Patient Re-engagement', category: 'medical',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#5b8f7d;padding:32px 40px;text-align:center">
    <p style="margin:0 0 4px;font-size:36px">🩺</p>
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Time for your check-up?</h1>
  </div>
  <div style="padding:32px 40px">
    <p style="margin:0 0 16px;color:#333;font-size:15px">Hi {name},</p>
    <p style="margin:0 0 20px;color:#555;line-height:1.7;font-size:15px">We noticed it has been a while since your last visit. Regular check-ups are an important part of maintaining your health — we'd love to see you again.</p>
    <p style="margin:0 0 28px;color:#555;line-height:1.7;font-size:15px">Book your next appointment at a time that suits you. It only takes a minute.</p>
    <div style="text-align:center">
      <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px">Book an Appointment</a>
    </div>
  </div>
  <div style="padding:20px 40px;background:#f0f7f5;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px;text-align:center">Your health is our priority · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
  {
    label: 'Health Tips', category: 'medical',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f7f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#fff;border-bottom:3px solid #5b8f7d;padding:24px 40px;display:flex;align-items:center;gap:12px">
    <p style="margin:0;font-size:24px">💚</p>
    <p style="margin:0;color:#5b8f7d;font-weight:800;font-size:16px;letter-spacing:0.05em">HEALTH TIPS — [Month] 2026</p>
  </div>
  <div style="padding:32px 40px">
    <p style="margin:0 0 20px;color:#333;font-size:15px">Hi {name},</p>
    <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:20px;font-weight:700">Tip #1: Add your first tip here</h2>
    <p style="margin:0 0 24px;color:#555;line-height:1.7;font-size:15px">Share a practical health tip relevant to your patients. Keep it simple and actionable.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:20px;font-weight:700">Tip #2: Add your second tip here</h2>
    <p style="margin:0 0 24px;color:#555;line-height:1.7;font-size:15px">A second tip keeps the email valuable and worth reading. Seasonal advice works well here.</p>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Book a Consultation</a>
  </div>
  <div style="padding:20px 40px;background:#f0f7f5">
    <p style="margin:0;color:#aaa;font-size:12px;text-align:center">© 2026 Your Practice · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },

  // ── B2B ───────────────────────────────────────────────────────────────────
  {
    label: 'Invoice Reminder', category: 'b2b',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#5b8f7d;padding:28px 40px">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Payment Reminder</h1>
  </div>
  <div style="padding:32px 40px">
    <p style="margin:0 0 16px;color:#333;font-size:15px">Hi {name},</p>
    <p style="margin:0 0 20px;color:#555;line-height:1.7;font-size:15px">I hope this message finds you well. I'm reaching out regarding the outstanding invoice below. Please let me know if you have any questions.</p>
    <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:20px 24px;margin:0 0 28px">
      <p style="margin:0 0 6px;color:#555;font-size:13px;font-weight:600">INVOICE DETAILS</p>
      <p style="margin:0 0 4px;color:#333;font-size:14px">Invoice #: <strong>[Invoice Number]</strong></p>
      <p style="margin:0 0 4px;color:#333;font-size:14px">Amount due: <strong>R[Amount]</strong></p>
      <p style="margin:0;color:#e53e3e;font-size:14px">Due date: <strong>[Due Date]</strong></p>
    </div>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">View Invoice</a>
  </div>
  <div style="padding:20px 40px;background:#fafafa;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px">© 2026 Your Business · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
  {
    label: 'Meeting Follow-up', category: 'b2b',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="padding:40px 40px 24px">
    <h1 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:800">Great connecting with you, {name}</h1>
    <div style="height:3px;width:48px;background:#5b8f7d;border-radius:2px"></div>
  </div>
  <div style="padding:0 40px 32px">
    <p style="margin:0 0 20px;color:#555;line-height:1.7;font-size:15px">Thank you for taking the time to meet with us. It was a pleasure learning more about your business and how we can help.</p>
    <p style="margin:0 0 8px;color:#333;font-weight:600;font-size:14px">Next steps we discussed:</p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#555;font-size:14px;line-height:1.8">
      <li>Add action item 1 here</li>
      <li>Add action item 2 here</li>
      <li>Follow-up call on [Date]</li>
    </ul>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Schedule Follow-up</a>
  </div>
  <div style="padding:20px 40px;background:#fafafa;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px">© 2026 Your Business · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
  {
    label: 'Quote / Proposal', category: 'b2b',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#5b8f7d;padding:28px 40px">
    <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:0.08em">YOUR BUSINESS NAME</p>
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Your Quotation is Ready</h1>
  </div>
  <div style="padding:32px 40px">
    <p style="margin:0 0 16px;color:#333;font-size:15px">Hi {name},</p>
    <p style="margin:0 0 24px;color:#555;line-height:1.7;font-size:15px">Thank you for your enquiry. Please find your personalised quote below. This quote is valid for 30 days from the date of issue.</p>
    <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:20px 24px;margin:0 0 28px">
      <p style="margin:0 0 6px;color:#555;font-size:13px;font-weight:600">QUOTE SUMMARY</p>
      <p style="margin:0 0 4px;color:#333;font-size:14px">Reference: <strong>[Quote Number]</strong></p>
      <p style="margin:0 0 4px;color:#333;font-size:14px">Service: <strong>[Service Description]</strong></p>
      <p style="margin:0 0 4px;color:#333;font-size:14px">Amount (excl. VAT): <strong>R[Amount]</strong></p>
      <p style="margin:0;color:#333;font-size:14px;font-weight:700;border-top:1px solid #eee;padding-top:10px;margin-top:10px">Total (incl. 15% VAT): R[Total]</p>
    </div>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Accept Quote</a>
  </div>
  <div style="padding:20px 40px;background:#fafafa;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px">© 2026 Your Business · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },

  // ── Property ──────────────────────────────────────────────────────────────
  {
    label: 'Lease Renewal Notice', category: 'property',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#5b8f7d;padding:28px 40px">
    <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:0.08em">PROPERTY MANAGEMENT</p>
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Lease Renewal Notice</h1>
  </div>
  <div style="padding:32px 40px">
    <p style="margin:0 0 16px;color:#333;font-size:15px">Dear {name},</p>
    <p style="margin:0 0 20px;color:#555;line-height:1.7;font-size:15px">Your lease agreement for <strong>[Property Address]</strong> is due to expire on <strong>[Expiry Date]</strong>. We'd love to continue this tenancy and have prepared a renewal offer for your consideration.</p>
    <div style="background:#f0f7f5;border-left:4px solid #5b8f7d;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 28px">
      <p style="margin:0 0 4px;color:#5b8f7d;font-weight:700;font-size:13px">RENEWAL TERMS</p>
      <p style="margin:0 0 4px;color:#333;font-size:14px">New monthly rental: <strong>R[New Rent]</strong></p>
      <p style="margin:0 0 4px;color:#333;font-size:14px">Lease period: <strong>[Duration]</strong></p>
      <p style="margin:0;color:#333;font-size:14px">Please respond by: <strong>[Response Deadline]</strong></p>
    </div>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Accept Renewal</a>
  </div>
  <div style="padding:20px 40px;background:#fafafa;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px">© 2026 Your Agency · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
  {
    label: 'Rent Reminder', category: 'property',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="padding:32px 40px 24px">
    <h1 style="margin:0 0 8px;color:#1a1a1a;font-size:20px;font-weight:800">Friendly Payment Reminder</h1>
    <div style="height:3px;width:48px;background:#5b8f7d;border-radius:2px"></div>
  </div>
  <div style="padding:0 40px 32px">
    <p style="margin:0 0 16px;color:#333;font-size:15px">Hi {name},</p>
    <p style="margin:0 0 20px;color:#555;line-height:1.7;font-size:15px">This is a friendly reminder that your rental payment for <strong>[Month]</strong> is due. Please see the details below.</p>
    <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:20px 24px;margin:0 0 28px">
      <p style="margin:0 0 4px;color:#333;font-size:14px">Property: <strong>[Property Address]</strong></p>
      <p style="margin:0 0 4px;color:#333;font-size:14px">Amount due: <strong>R[Amount]</strong></p>
      <p style="margin:0;color:#e53e3e;font-size:14px">Due by: <strong>[Due Date]</strong></p>
    </div>
    <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.7">Please use your reference number <strong>[Ref Number]</strong> when making payment. If you have already paid, please disregard this message.</p>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Submit Proof of Payment</a>
  </div>
  <div style="padding:20px 40px;background:#fafafa;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px">© 2026 Your Agency · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
  {
    label: 'Maintenance Update', category: 'property',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#5b8f7d;padding:28px 40px">
    <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:0.08em">MAINTENANCE UPDATE</p>
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Your request has been received</h1>
  </div>
  <div style="padding:32px 40px">
    <p style="margin:0 0 16px;color:#333;font-size:15px">Hi {name},</p>
    <p style="margin:0 0 20px;color:#555;line-height:1.7;font-size:15px">We've received your maintenance request and our team is on it. Here's a summary of what was logged:</p>
    <div style="background:#f0f7f5;border-left:4px solid #5b8f7d;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px">
      <p style="margin:0 0 4px;color:#5b8f7d;font-weight:700;font-size:13px">REQUEST DETAILS</p>
      <p style="margin:0 0 4px;color:#333;font-size:14px">Issue: <strong>[Issue Description]</strong></p>
      <p style="margin:0 0 4px;color:#333;font-size:14px">Status: <strong>[In Progress / Scheduled]</strong></p>
      <p style="margin:0;color:#333;font-size:14px">Expected completion: <strong>[Date]</strong></p>
    </div>
    <p style="margin:0;color:#555;font-size:14px;line-height:1.7">We'll keep you updated. If you have any urgent concerns, please don't hesitate to contact us directly.</p>
  </div>
  <div style="padding:20px 40px;background:#fafafa;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px">© 2026 Your Agency · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },

  // ── Retail ────────────────────────────────────────────────────────────────
  {
    label: 'Welcome Email', category: 'retail',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:linear-gradient(135deg,#5b8f7d 0%,#3d6b5c 100%);padding:48px 40px;text-align:center">
    <p style="margin:0 0 8px;font-size:40px">🎉</p>
    <h1 style="margin:0 0 8px;color:#fff;font-size:26px;font-weight:800">Welcome, {name}!</h1>
    <p style="margin:0;color:rgba(255,255,255,0.85);font-size:15px">We're so glad you're here.</p>
  </div>
  <div style="padding:40px">
    <p style="margin:0 0 20px;color:#555;line-height:1.7;font-size:15px">Thank you for joining us! We can't wait for you to experience everything we have to offer. Here's what you can look forward to:</p>
    <ul style="margin:0 0 28px;padding-left:20px;color:#555;font-size:14px;line-height:2">
      <li>Exclusive member deals and early access</li>
      <li>Personalised recommendations just for you</li>
      <li>Priority booking and appointment slots</li>
    </ul>
    <div style="text-align:center">
      <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px">Explore Now →</a>
    </div>
  </div>
  <div style="padding:20px 40px;background:#fafafa;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px;text-align:center">© 2026 Your Business · <a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
  {
    label: 'Weekly Deal', category: 'retail',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto">
  <div style="background:#1a1a1a;padding:20px 40px;text-align:center">
    <p style="margin:0;color:#5b8f7d;font-weight:800;font-size:13px;letter-spacing:0.1em">THIS WEEK ONLY</p>
  </div>
  <div style="background:linear-gradient(135deg,#5b8f7d 0%,#3d6b5c 100%);padding:48px 40px;text-align:center">
    <h1 style="margin:0 0 8px;color:#fff;font-size:36px;font-weight:900">[Deal Title]</h1>
    <p style="margin:0 0 24px;color:rgba(255,255,255,0.85);font-size:16px">Hi {name}, this one's for you.</p>
    <div style="display:inline-block;background:#fff;border-radius:12px;padding:16px 32px">
      <p style="margin:0;color:#1a1a1a;font-size:14px;font-weight:600">Use code</p>
      <p style="margin:4px 0 0;color:#5b8f7d;font-size:28px;font-weight:900;letter-spacing:0.05em">[CODE]</p>
    </div>
  </div>
  <div style="background:#fff;padding:32px 40px;text-align:center">
    <p style="margin:0 0 24px;color:#555;line-height:1.7;font-size:15px">Describe your weekly deal here. What's on offer, what's the discount, and why should they act now?</p>
    <a href="#" style="display:inline-block;background:#5b8f7d;color:#fff;text-decoration:none;padding:14px 40px;border-radius:10px;font-weight:700;font-size:15px">Claim Deal</a>
    <p style="margin:16px 0 0;color:#999;font-size:12px">Offer expires [Date]. While stocks last.</p>
  </div>
  <div style="padding:20px 40px;background:#f9f9f9;border-top:1px solid #eee">
    <p style="margin:0;color:#aaa;font-size:12px;text-align:center"><a href="#" style="color:#5b8f7d">Unsubscribe</a></p>
  </div>
</div>
</body></html>`,
  },
]

// ── SA phone normalisation ────────────────────────────────────────────────────
function normalizeSAPhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('27') && digits.length === 11) return '+' + digits
  if (digits.startsWith('0') && digits.length === 10) return '+27' + digits.slice(1)
  if (digits.length === 9) return '+27' + digits
  return '+' + digits
}

// ── Industry config ───────────────────────────────────────────────────────────
const INDUSTRY_CONFIG = {
  medical: {
    contactCollection: 'patients',
    contactLabel:      'Patient',
    getName: c => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || '—',
    defaultTemplate:   'Hello {name}, this is a message from our practice. Please contact us if you have any questions.',
    mergeTags: ['{name}', '{email}', '{phone}', '{unsubscribe_link}'],
    customFilters: [
      { key: 'has_email',       label: 'Has email address',              filter: c => !!c.email },
      { key: 'has_phone',       label: 'Has phone number',               filter: c => !!c.phone },
      { key: 'no_recent_appt',  label: 'No appointment in last 90 days', needsAppointments: true },
      { key: 'has_chronic',     label: 'Has chronic condition',          filter: c => Array.isArray(c.chronicConditions) && c.chronicConditions.length > 0 },
      { key: 'has_medical_aid', label: 'Has medical aid',                filter: c => !!c.medicalAid },
      { key: 'no_medical_aid',  label: 'No medical aid (private)',       filter: c => !c.medicalAid },
    ],
  },

  b2b: {
    contactCollection: 'customers',
    contactLabel:      'Client',
    getName: c => c.company || c.name || c.email || '—',
    defaultTemplate:   'Dear {name}, we would like to reach out to you regarding your account with us.',
    mergeTags: ['{name}', '{company}', '{email}', '{phone}', '{unsubscribe_link}'],
    customFilters: [
      { key: 'has_email',      label: 'Has email address',               filter: c => !!c.email },
      { key: 'has_phone',      label: 'Has phone number',                filter: c => !!c.phone },
      { key: 'no_recent_appt', label: 'No appointment in last 90 days',  needsAppointments: true },
    ],
  },

  property: {
    contactCollection: 'tenants',
    contactLabel:      'Tenant',
    getName: c => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || '—',
    defaultTemplate:   'Dear {name}, this is a message from your property manager. Please contact us if you have any queries.',
    mergeTags: ['{name}', '{email}', '{phone}', '{unsubscribe_link}'],
    customFilters: [
      { key: 'has_email',       label: 'Has email address',              filter: c => !!c.email },
      { key: 'has_phone',       label: 'Has phone number',               filter: c => !!c.phone },
      { key: 'no_recent_appt',  label: 'No appointment in last 90 days', needsAppointments: true },
      {
        key: 'lease_ending_60', label: 'Lease ending within 60 days',
        filter: c => {
          if (!c.leaseEnd) return false
          const diff = (new Date(c.leaseEnd) - new Date()) / (1000 * 60 * 60 * 24)
          return diff >= 0 && diff <= 60
        },
      },
      {
        key: 'lease_ending_30', label: 'Lease ending within 30 days',
        filter: c => {
          if (!c.leaseEnd) return false
          const diff = (new Date(c.leaseEnd) - new Date()) / (1000 * 60 * 60 * 24)
          return diff >= 0 && diff <= 30
        },
      },
    ],
  },

  retail: {
    contactCollection: 'customers',
    contactLabel:      'Customer',
    getName: c => c.name || c.email || '—',
    defaultTemplate:   'Hi {name}, we have something exciting to share with you!',
    mergeTags: ['{name}', '{email}', '{phone}', '{unsubscribe_link}'],
    customFilters: [
      { key: 'has_email',      label: 'Has email address',               filter: c => !!c.email },
      { key: 'has_phone',      label: 'Has phone number',                filter: c => !!c.phone },
      { key: 'no_recent_appt', label: 'No appointment in last 90 days',  needsAppointments: true },
      {
        key: 'birthday_month', label: 'Birthday this month',
        filter: c => {
          const raw = c.birthday || c.dob
          if (!raw) return false
          return new Date(raw).getMonth() === new Date().getMonth()
        },
      },
    ],
  },
}

// ── Shared UI constants ───────────────────────────────────────────────────────
const STATUS_STYLES = {
  Sent:          'bg-green-100 text-green-700',
  Partial:       'bg-amber-100 text-amber-700',
  Failed:        'bg-red-100 text-red-600',
  Draft:         'bg-gray-100 text-gray-500',
  Scheduled:     'bg-blue-100 text-blue-600',
  Sending:       'bg-purple-100 text-purple-600',
  QuotaExceeded: 'bg-red-100 text-red-600',
  Recurring:     'bg-indigo-100 text-indigo-600',
  Paused:        'bg-slate-200 text-slate-600',
}

const TOPUP_BUNDLES = [
  { key: 't500',  messages: 500,  price: 200 },
  { key: 't1000', messages: 1000, price: 380 },
  { key: 't2500', messages: 2500, price: 900 },
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const CHANNEL_META = {
  sms:   { label: 'SMS',   icon: PhoneIcon, color: 'text-blue-600',    description: 'Text message directly to mobile numbers' },
  email: { label: 'Email', icon: Mail,      color: 'text-emerald-600', description: 'Rich email with templates, images & tracking' },
}

const BLANK_SENDTO = { mode: 'all', tags: [], filters: [] }

// ── Component ─────────────────────────────────────────────────────────────────
export default function CampaignsModule({ industry }) {
  const { user, profile } = useAuth()
  const uid    = user?.uid
  const config = INDUSTRY_CONFIG[industry]

  // Collections
  const contacts     = useCollection(uid && config ? `users/${uid}/${config.contactCollection}` : null)
  const campaigns    = useCollection(uid ? `users/${uid}/campaigns` : null)
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)
  const myTemplates  = useCollection(uid ? `users/${uid}/emailTemplates` : null)
  const audiences    = useCollection(uid ? `users/${uid}/audiences` : null)

  // View state: 'list' | 'wizard'
  const [view,        setView]        = useState('list')
  const [step,        setStep]        = useState(1)   // wizard step 1-4
  const [campaignName, setCampaignName] = useState('')
  const [sending,     setSending]     = useState(false)
  const [done,        setDone]        = useState(false)
  const [scheduled,   setScheduled]   = useState(false)
  const [progress,    setProgress]    = useState({ sent: 0, failed: 0, total: 0 })
  const [quotaError,  setQuotaError]  = useState(null)

  // Draft editing: id of the campaign doc being resumed, null for new campaigns
  const [editingDraftId, setEditingDraftId] = useState(null)
  const [savingDraft,    setSavingDraft]    = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savingAudience, setSavingAudience] = useState(false)

  // Recurring send config
  const [recurFreq, setRecurFreq] = useState('weekly')   // 'weekly' | 'monthly'
  const [recurDay,  setRecurDay]  = useState(1)          // dayOfWeek (0-6) or dayOfMonth (1-28)
  const [recurTime, setRecurTime] = useState('09:00')

  // Quota top-up purchase
  const [topupOpen,   setTopupOpen]   = useState(false)
  const [topupBuying, setTopupBuying] = useState(null)

  // Review-request modal state
  const [reviewModal,   setReviewModal]   = useState(false)
  const [reviewContact, setReviewContact] = useState(null)
  const [reviewSearch,  setReviewSearch]  = useState('')
  const [reviewSending, setReviewSending] = useState(false)
  const [reviewDone,    setReviewDone]    = useState(false)

  // Compose state
  const [sendTo,        setSendTo]        = useState(BLANK_SENDTO)
  const [channel,       setChannel]       = useState('sms')
  const [subject,       setSubject]       = useState('')
  const [body,          setBody]          = useState('')
  const [sendMode,      setSendMode]      = useState('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')

  // Email-specific state
  const [emailMode,     setEmailMode]     = useState('text')   // 'text' | 'html'
  const [previewText,   setPreviewText]   = useState('')
  const [showPreview,   setShowPreview]   = useState(false)
  const [previewDevice, setPreviewDevice] = useState('desktop')
  const [showTemplates,   setShowTemplates]   = useState(false)
  const [templateFilter,  setTemplateFilter]  = useState('all')
  const [testEmailAddr, setTestEmailAddr] = useState('')
  const [sendingTest,   setSendingTest]   = useState(false)
  const [testSent,      setTestSent]      = useState(null)     // null | 'success' | 'error'

  // Unlayer visual editor (emailMode === 'unlayer')
  const emailEditorRef = useRef(null)
  const [unlayerReady, setUnlayerReady] = useState(false)

  // Detail view state
  const [viewCampaign, setViewCampaign] = useState(null)
  const [campaignMsgs, setCampaignMsgs] = useState([])
  const [loadingMsgs,  setLoadingMsgs]  = useState(false)

  // Refs
  const bodyTextareaRef = useRef(null)
  const htmlFileRef     = useRef(null)

  // ── Tag extraction ──────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const s = new Set()
    contacts.forEach(c => {
      if (Array.isArray(c.tags)) c.tags.forEach(t => { if (t?.trim()) s.add(t.trim()) })
    })
    return [...s].sort()
  }, [contacts])

  // ── 90-day appointment set ─────────────────────────────────────────────────
  const recentApptNames = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const s = new Set()
    appointments
      .filter(a => a.date && a.date >= cutoffStr)
      .forEach(a => { if (a.patient) s.add(a.patient) })
    return s
  }, [appointments])

  // ── Recipient resolution ───────────────────────────────────────────────────
  const resolution = useMemo(() => {
    if (!contacts.length || !config) return { included: [], optedOut: 0, noContactInfo: 0 }

    let pool = contacts.slice()

    if (sendTo.mode === 'tagged') {
      pool = sendTo.tags.length === 0
        ? []
        : contacts.filter(c =>
            Array.isArray(c.tags) && sendTo.tags.some(t => c.tags.includes(t))
          )
    } else if (sendTo.mode === 'custom') {
      if (sendTo.filters.length > 0) {
        pool = contacts.filter(c =>
          sendTo.filters.every(fKey => {
            const fDef = config.customFilters.find(f => f.key === fKey)
            if (!fDef) return true
            if (fDef.needsAppointments) return !recentApptNames.has(config.getName(c))
            return fDef.filter(c)
          })
        )
      }
    }

    const optedOut = pool.filter(c => c.marketingOptOut === true).length
    pool = pool.filter(c => c.marketingOptOut !== true)

    const hasContact    = c => channel === 'email' ? !!c.email : !!c.phone
    const noContactInfo = pool.filter(c => !hasContact(c)).length
    const included      = pool.filter(hasContact)

    return { included, optedOut, noContactInfo }
  }, [contacts, config, sendTo, channel, recentApptNames])

  const { included: recipients, optedOut, noContactInfo } = resolution

  // ── Quota helpers ─────────────────────────────────────────────────────────
  const planKey   = profile?.plan ?? 'starter'
  const planLimit = (PLANS[planKey]?.messages ?? 100) + (profile?.topupMessages ?? 0)
  const used      = profile?.messagesUsed ?? 0
  const remaining = planLimit - used

  function checkQuota(count) {
    if (count > remaining) {
      setQuotaError(
        `This campaign would send ${count} message${count !== 1 ? 's' : ''}, ` +
        `but you only have ${remaining} remaining on your ${planKey} plan ` +
        `(${used.toLocaleString('en-ZA')} / ${planLimit.toLocaleString('en-ZA')} used). ` +
        `Please reduce your recipient list or upgrade your plan.`
      )
      return false
    }
    setQuotaError(null)
    return true
  }

  // ── Segment label builder ─────────────────────────────────────────────────
  function buildSegmentLabel() {
    if (sendTo.mode === 'tagged') {
      return sendTo.tags.length
        ? `Tagged: ${sendTo.tags.join(', ')}`
        : 'Tagged with (none selected)'
    }
    if (sendTo.mode === 'custom') {
      const labels = sendTo.filters.map(
        fKey => config.customFilters.find(f => f.key === fKey)?.label ?? fKey
      )
      return labels.length ? labels.join(' + ') : 'Custom filter'
    }
    return 'All contacts'
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function toggleTag(tag) {
    setSendTo(s => ({
      ...s,
      tags: s.tags.includes(tag) ? s.tags.filter(t => t !== tag) : [...s.tags, tag],
    }))
  }

  function toggleFilter(key) {
    setSendTo(s => ({
      ...s,
      filters: s.filters.includes(key) ? s.filters.filter(k => k !== key) : [...s.filters, key],
    }))
  }

  // Insert a merge tag at the current cursor position in the body textarea
  function insertMergeTag(tag) {
    const el = bodyTextareaRef.current
    if (!el) { setBody(b => b + tag); return }
    const start = el.selectionStart ?? body.length
    const end   = el.selectionEnd   ?? body.length
    setBody(b => b.slice(0, start) + tag + b.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + tag.length, start + tag.length)
    })
  }

  // Inject 1×1 tracking pixel + wrap links (HTML mode only) before sending
  function injectEmailTracking(htmlBody, campaignId, contactId) {
    const BASE  = 'https://tlhiso.com'
    const r     = encodeURIComponent(String(contactId || 'unknown'))
    const pixel = `<img src="${BASE}/track/open?u=${uid}&c=${campaignId}&r=${r}" width="1" height="1" style="display:none;border:0" alt="">`
    let result  = (emailMode === 'html')
      ? htmlBody.replace(/href="(https?:\/\/[^"]*?)"/gi, (_, href) => {
          if (href.includes('/track/')) return `href="${href}"`
          return `href="${BASE}/track/click?u=${uid}&c=${campaignId}&r=${r}&url=${encodeURIComponent(href)}"`
        })
      : htmlBody
    return result.includes('</body>')
      ? result.replace('</body>', `${pixel}</body>`)
      : result + pixel
  }

  // Read an uploaded .html file into the body
  function handleHtmlFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setBody(ev.target?.result ?? '')
    reader.readAsText(file)
    e.target.value = ''
  }

  // Resolve all merge tags for a specific contact
  function resolveMergeTags(text, contact) {
    const name = config.getName(contact)
    return text
      .replace(/\{name\}/gi,    name)
      .replace(/\{email\}/gi,   contact.email   || '')
      .replace(/\{phone\}/gi,   contact.phone   || '')
      .replace(/\{company\}/gi, contact.company || name)
  }

  // Wrap plain text in a basic HTML email shell; HTML mode returns as-is
  function resolveEmailBody(resolvedText) {
    if (emailMode === 'html') return resolvedText
    const paragraphs = resolvedText
      .split(/\n{2,}/)
      .map(p => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
      .join('')
    return `<div style="font-family:sans-serif;color:#333;max-width:600px;padding:16px">${paragraphs}</div>`
  }

  // Build the HTML document shown in the preview iframe
  function buildPreviewHtml() {
    const sampleContact = recipients[0] ?? {
      firstName: 'Valued', lastName: 'Customer',
      name: 'Valued Customer', email: 'you@example.com',
      phone: '+27800000000', company: 'Your Company',
    }
    const resolved = resolveMergeTags(body, sampleContact)
    if (emailMode === 'html') return resolved
    const paragraphs = resolved
      .split(/\n{2,}/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('')
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;line-height:1.6;color:#333;padding:24px;max-width:600px;margin:0 auto">${paragraphs}</body></html>`
  }

  function openModal() {
    setSendTo(BLANK_SENDTO)
    setChannel('sms')
    setSubject('')
    setCampaignName('')
    setBody(config?.defaultTemplate ?? '')
    setDone(false)
    setScheduled(false)
    setSending(false)
    setProgress({ sent: 0, failed: 0, total: 0 })
    setSendMode('now')
    setScheduledDate('')
    setScheduledTime('09:00')
    setQuotaError(null)
    setEmailMode('text')
    setPreviewText('')
    setShowPreview(false)
    setPreviewDevice('desktop')
    setShowTemplates(false)
    setTestEmailAddr('')
    setSendingTest(false)
    setTestSent(null)
    setUnlayerReady(false)
    setEditingDraftId(null)
    setRecurFreq('weekly')
    setRecurDay(1)
    setRecurTime('09:00')
    setStep(1)
    setView('wizard')
  }

  function closeModal() {
    if (sending) return
    setView('list')
  }

  // Load an existing campaign into the wizard — as a resumed draft
  // (draftId set, send updates the same doc) or as a duplicate (draftId null).
  function loadCampaignIntoWizard(c, draftId = null) {
    openModal()
    const seg = c.segmentDefinition ?? {}
    setSendTo({ mode: seg.mode ?? 'all', tags: seg.tags ?? [], filters: seg.filters ?? [] })
    setChannel(c.channel ?? 'sms')
    setSubject(c.subject ?? '')
    setCampaignName(draftId
      ? (c.campaignName ?? '')
      : `${c.campaignName || c.subject || 'Campaign'} (copy)`)
    setBody(c.body ?? '')
    setPreviewText(c.previewText ?? '')
    if (c.channel === 'email') setEmailMode(c.emailMode === 'html' ? 'html' : 'text')
    setEditingDraftId(draftId)
  }

  // Save the wizard state as a Draft campaign and return to the list
  async function saveDraft() {
    if (!uid || savingDraft) return
    setSavingDraft(true)
    try {
      let emailHtml = null
      if (channel === 'email' && emailMode === 'unlayer' && emailEditorRef.current?.editor) {
        emailHtml = await new Promise(res =>
          emailEditorRef.current.editor.exportHtml(({ html }) => res(html))
        )
      }
      const payload = { ...baseCampaignPayload(emailHtml), status: 'Draft' }
      if (editingDraftId) {
        const { createdAt, ...rest } = payload
        await updateDoc(doc(db, 'users', uid, 'campaigns', editingDraftId),
          { ...rest, updatedAt: serverTimestamp() })
      } else {
        await addDoc(collection(db, 'users', uid, 'campaigns'), payload)
      }
      setView('list')
    } catch (e) {
      alert('Failed to save draft: ' + e.message)
    } finally {
      setSavingDraft(false)
    }
  }

  // Save the current HTML email body as a reusable personal template
  async function saveAsTemplate() {
    if (!body.trim() || savingTemplate) return
    const name = window.prompt('Template name:')
    if (!name?.trim()) return
    setSavingTemplate(true)
    try {
      await addDoc(collection(db, 'users', uid, 'emailTemplates'), {
        name: name.trim(),
        html: body,
        createdAt: serverTimestamp(),
      })
      setTemplateFilter('mine')
      setShowTemplates(true)
    } catch (e) {
      alert('Failed to save template: ' + e.message)
    } finally {
      setSavingTemplate(false)
    }
  }

  // ── Saved audiences ────────────────────────────────────────────────────────
  async function saveAudience() {
    if (sendTo.mode === 'all' || savingAudience) return
    const name = window.prompt('Audience name (e.g. "Lapsed patients"):')
    if (!name?.trim()) return
    setSavingAudience(true)
    try {
      await addDoc(collection(db, 'users', uid, 'audiences'), {
        name: name.trim(),
        mode: sendTo.mode,
        tags: sendTo.tags,
        filters: sendTo.filters,
        createdAt: serverTimestamp(),
      })
    } catch (e) {
      alert('Failed to save audience: ' + e.message)
    } finally {
      setSavingAudience(false)
    }
  }

  function applyAudience(a) {
    setSendTo({ mode: a.mode ?? 'all', tags: a.tags ?? [], filters: a.filters ?? [] })
  }

  // ── Recurring schedule ─────────────────────────────────────────────────────
  // First-run time computed in the browser (SAST); the Cloud Function keeps
  // subsequent runs aligned.
  function computeFirstRun() {
    const [h, m] = String(recurTime || '09:00').split(':').map(Number)
    const now = new Date()
    const next = new Date()
    next.setHours(h ?? 9, m ?? 0, 0, 0)
    if (recurFreq === 'weekly') {
      let add = ((Number(recurDay) || 0) - next.getDay() + 7) % 7
      if (add === 0 && next <= now) add = 7
      next.setDate(next.getDate() + add)
    } else {
      next.setDate(Math.min(Number(recurDay) || 1, 28))
      if (next <= now) next.setMonth(next.getMonth() + 1)
    }
    return next
  }

  async function startRecurring() {
    const hasContent = emailMode === 'unlayer' ? unlayerReady : body.trim()
    if (!uid || !hasContent || recipients.length === 0) return

    let emailHtml = null
    if (channel === 'email' && emailMode === 'unlayer' && emailEditorRef.current?.editor) {
      emailHtml = await new Promise(res =>
        emailEditorRef.current.editor.exportHtml(({ html }) => res(html))
      )
    }

    const recurrence = {
      freq: recurFreq,
      time: recurTime,
      ...(recurFreq === 'weekly'
        ? { dayOfWeek: Number(recurDay) }
        : { dayOfMonth: Number(recurDay) }),
    }
    const payload = {
      ...baseCampaignPayload(emailHtml),
      status:     'Recurring',
      recurrence,
      nextRunAt:  Timestamp.fromDate(computeFirstRun()),
    }
    if (editingDraftId) {
      const { createdAt, ...rest } = payload
      await updateDoc(doc(db, 'users', uid, 'campaigns', editingDraftId), rest)
    } else {
      await addDoc(collection(db, 'users', uid, 'campaigns'), payload)
    }
    setScheduled(true)
  }

  // ── Quota top-up via PayFast ───────────────────────────────────────────────
  function loadPayfastSdk() {
    return new Promise((resolve, reject) => {
      if (window.payfast_do_onsite_payment) return resolve()
      const s = document.createElement('script')
      s.src = 'https://www.payfast.co.za/onsite/engine.js'
      s.onload = resolve
      s.onerror = () => reject(new Error('Could not load the payment SDK.'))
      document.head.appendChild(s)
    })
  }

  async function buyTopup(bundleKey) {
    setTopupBuying(bundleKey)
    try {
      await loadPayfastSdk()
      const res = await httpsCallable(functions, 'createPayfastTopup')({ bundleKey })
      const { uuid } = res.data ?? {}
      if (!uuid) throw new Error('No payment session returned.')
      window.payfast_do_onsite_payment({ uuid }, success => {
        setTopupBuying(null)
        if (success) {
          setTopupOpen(false)
          alert('Top-up payment received! Your extra messages will reflect within a minute.')
        }
      })
    } catch (e) {
      alert('Could not start payment: ' + e.message)
      setTopupBuying(null)
    }
  }

  async function sendReviewToContact() {
    const contact = reviewContact
    if (!contact || !profile?.googleReviewLink) return
    if (remaining < 1) {
      alert(`You have no messages remaining on your ${planKey} plan this month. Please upgrade to continue sending.`)
      return
    }
    const phone = normalizeSAPhone(contact.phone)
    const email = contact.email
    if (!phone && !email) return
    const firstName = (config.getName(contact) || 'there').split(' ')[0]
    const rawLink = profile.googleReviewLinkShort || profile.googleReviewLink
    const link = phone ? await shortenUrl(rawLink) : rawLink
    const message = `Hi ${firstName}, thank you for choosing us! We'd love your feedback. Please leave us a Google review: ${link}`
    setReviewSending(true)
    try {
      let res
      if (phone) {
        res = await httpsCallable(functions, 'sendSMS')({ to: phone, message })
        if (!res.data?.success) throw new Error(res.data?.error || 'BulkSMS rejected the message')
      } else {
        res = await httpsCallable(functions, 'sendEmail')({
          to: email,
          subject: 'Leave us a Google Review',
          htmlBody: `<p>Hi ${firstName},</p><p>Thank you for choosing us! We'd love your feedback.</p><p><a href="${link}">Leave us a Google Review</a></p>`,
        })
        if (!res.data?.success) throw new Error(res.data?.error || 'Email send failed')
      }
      await Promise.all([
        addDoc(collection(db, 'users', uid, 'messages'), {
          to: phone || email,
          type: phone ? 'sms' : 'email',
          body: message,
          module: 'review-request',
          status: 'sent',
          sentAt: serverTimestamp(),
        }),
        updateDoc(doc(db, 'users', uid), { messagesUsed: increment(1) }),
      ])
      setReviewDone(true)
    } catch (e) {
      alert('Failed to send review request: ' + e.message)
    } finally {
      setReviewSending(false)
    }
  }

  // ── Send test email ────────────────────────────────────────────────────────
  async function sendTestEmail() {
    if (!testEmailAddr.trim()) return
    if (emailMode !== 'unlayer' && !body.trim()) return
    setSendingTest(true)
    setTestSent(null)
    try {
      const sampleContact = recipients[0] ?? {
        firstName: 'Test', lastName: 'Recipient',
        name: 'Test Recipient', email: testEmailAddr.trim(),
        phone: '', company: '',
      }
      let finalHtml
      if (emailMode === 'unlayer' && emailEditorRef.current?.editor) {
        finalHtml = await new Promise(res =>
          emailEditorRef.current.editor.exportHtml(({ html }) => res(html))
        )
      } else {
        const resolved = resolveMergeTags(body, sampleContact)
        const htmlBody = resolveEmailBody(resolved)
        finalHtml = emailMode === 'html'
          ? htmlBody
          : `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#333;padding:24px">${htmlBody}</body></html>`
      }
      await httpsCallable(functions, 'sendEmail')({
        to:       testEmailAddr.trim(),
        subject:  `[TEST] ${subject.trim() || 'Campaign Preview'}`,
        htmlBody: finalHtml,
      })
      setTestSent('success')
    } catch {
      setTestSent('error')
    } finally {
      setSendingTest(false)
    }
  }

  // ── Shared campaign payload ───────────────────────────────────────────────
  function baseCampaignPayload(emailHtml = null) {
    const segmentLabel = buildSegmentLabel()
    const resolvedBody = channel === 'email' && emailMode === 'unlayer' ? (emailHtml ?? '') : body
    return {
      campaignName: campaignName.trim() || subject.trim() || segmentLabel,
      subject: subject.trim() || campaignName.trim() || segmentLabel,
      body: resolvedBody,
      channel,
      ...(channel === 'email' && {
        emailMode: emailMode === 'unlayer' ? 'html' : emailMode,
        previewText: previewText.trim() || null,
      }),
      segmentDefinition: {
        mode:    sendTo.mode,
        tags:    sendTo.mode === 'tagged' ? sendTo.tags    : [],
        filters: sendTo.mode === 'custom' ? sendTo.filters : [],
      },
      segmentLabel,
      recipientCount: recipients.length,
      optOutCount:    optedOut,
      industry,
      createdAt:      serverTimestamp(),
    }
  }

  // ── Send now ───────────────────────────────────────────────────────────────
  async function sendNow() {
    const hasContent = emailMode === 'unlayer' ? unlayerReady : body.trim()
    if (!uid || !hasContent || recipients.length === 0) return
    if (!checkQuota(recipients.length)) return

    let unlayerHtmlExport = null
    if (channel === 'email' && emailMode === 'unlayer' && emailEditorRef.current?.editor) {
      unlayerHtmlExport = await new Promise(res =>
        emailEditorRef.current.editor.exportHtml(({ html }) => res(html))
      )
    }

    setSending(true)
    const total = recipients.length
    setProgress({ sent: 0, failed: 0, total })

    let campaignRef
    if (editingDraftId) {
      // Resumed draft — send from the same doc so history shows one campaign
      campaignRef = doc(db, 'users', uid, 'campaigns', editingDraftId)
      const { createdAt, ...rest } = baseCampaignPayload(unlayerHtmlExport)
      await updateDoc(campaignRef, { ...rest, status: 'Sending' })
    } else {
      campaignRef = await addDoc(
        collection(db, 'users', uid, 'campaigns'),
        { ...baseCampaignPayload(unlayerHtmlExport), status: 'Sending' }
      )
    }

    let sent = 0, failed = 0

    for (const contact of recipients) {
      const unsubToken = btoa(JSON.stringify({ uid, col: config.contactCollection, id: contact.id }))
      const unsubUrl   = `${window.location.origin}/unsubscribe?t=${unsubToken}`
      const baseBody   = emailMode === 'unlayer' ? (unlayerHtmlExport ?? '') : body
      let resolved     = resolveMergeTags(baseBody, contact)
      resolved         = resolved.replace(/\{unsubscribe_link\}/gi, unsubUrl)
      const builtHtml  = channel === 'email' ? resolveEmailBody(resolved) : resolved
      const msgBody    = channel === 'email'
        ? injectEmailTracking(builtHtml, campaignRef.id, contact.id)
        : builtHtml
      const to        = channel === 'email'
        ? contact.email
        : normalizeSAPhone(contact.phone)
      try {
        await sendMessage({
          type:    channel,
          to,
          subject: channel === 'email'
            ? (subject.trim() || `Message from your ${config.contactLabel.toLowerCase()} service`)
            : undefined,
          body:    msgBody,
          module:  'campaigns',
        })
        sent++
        addDoc(collection(db, 'users', uid, 'messages'), {
          to, type: channel, body: msgBody,
          status: 'sent', module: 'campaigns',
          campaignId: campaignRef.id,
          sentAt: serverTimestamp(),
        }).catch(e => console.error('[campaigns] message log failed:', e.message))
      } catch {
        failed++
        addDoc(collection(db, 'users', uid, 'messages'), {
          to, type: channel, body: msgBody,
          status: 'failed', module: 'campaigns',
          campaignId: campaignRef.id,
          sentAt: serverTimestamp(),
        }).catch(e => console.error('[campaigns] failure log failed:', e.message))
      }
      setProgress({ sent, failed, total })
    }

    const finalStatus = failed === 0 ? 'Sent' : sent === 0 ? 'Failed' : 'Partial'

    await updateDoc(campaignRef, {
      sentCount:   sent,
      failedCount: failed,
      status:      finalStatus,
      sentAt:      serverTimestamp(),
    })

    if (sent > 0) {
      await updateDoc(doc(db, 'users', uid), { messagesUsed: increment(sent) })
    }

    setSending(false)
    setDone(true)
  }

  // ── Schedule for later ─────────────────────────────────────────────────────
  async function scheduleLater() {
    const hasContent = emailMode === 'unlayer' ? unlayerReady : body.trim()
    if (!uid || !hasContent || recipients.length === 0) return

    if (!scheduledDate || !scheduledTime) {
      setQuotaError('Please choose a date and time for the scheduled send.')
      return
    }

    const scheduledForDate = new Date(`${scheduledDate}T${scheduledTime}`)
    if (isNaN(scheduledForDate.getTime()) || scheduledForDate <= new Date()) {
      setQuotaError('Scheduled time must be in the future.')
      return
    }

    if (!checkQuota(recipients.length)) return

    let emailHtml = null
    if (channel === 'email' && emailMode === 'unlayer' && emailEditorRef.current?.editor) {
      emailHtml = await new Promise(res =>
        emailEditorRef.current.editor.exportHtml(({ html }) => res(html))
      )
    }

    if (editingDraftId) {
      const { createdAt, ...rest } = baseCampaignPayload(emailHtml)
      await updateDoc(doc(db, 'users', uid, 'campaigns', editingDraftId), {
        ...rest,
        status:       'Scheduled',
        scheduledFor: Timestamp.fromDate(scheduledForDate),
      })
    } else {
      await addDoc(
        collection(db, 'users', uid, 'campaigns'),
        {
          ...baseCampaignPayload(emailHtml),
          status:       'Scheduled',
          scheduledFor: Timestamp.fromDate(scheduledForDate),
        }
      )
    }

    setScheduled(true)
  }

  // ── Campaign detail ────────────────────────────────────────────────────────
  async function openDetail(campaign) {
    setViewCampaign(campaign)
    setCampaignMsgs([])
    setLoadingMsgs(true)
    try {
      const q = query(
        collection(db, 'users', uid, 'messages'),
        where('campaignId', '==', campaign.id)
      )
      const snap = await getDocs(q)
      setCampaignMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } finally {
      setLoadingMsgs(false)
    }
  }

  // ── History table ──────────────────────────────────────────────────────────
  const sortedCampaigns = useMemo(
    () => [...campaigns].sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    ),
    [campaigns],
  )

  const cols = [
    {
      key: 'subject', label: 'Campaign',
      render: r => (
        <div>
          <p className="font-semibold text-slate-800">{r.campaignName || r.subject || '—'}</p>
          <p className="text-xs text-slate-500">{r.segmentLabel || '—'}</p>
        </div>
      ),
    },
    {
      key: 'channel', label: 'Channel',
      render: r => {
        const meta = CHANNEL_META[r.channel]
        if (!meta) return <span className="text-xs capitalize">{r.channel ?? '—'}</span>
        const Icon = meta.icon
        return (
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${meta.color}`}>
            <Icon size={13} /> {meta.label}
          </span>
        )
      },
    },
    {
      key: 'recipientCount', label: 'Recipients',
      render: r => <span className="text-sm font-semibold text-ink">{r.recipientCount ?? '—'}</span>,
    },
    {
      key: 'sentCount', label: 'Sent',
      render: r => r.status === 'Scheduled'
        ? <span className="text-xs text-ink-secondary">—</span>
        : <span className="text-sm font-semibold text-green-700">{r.sentCount ?? '—'}</span>,
    },
    {
      key: 'uniqueOpenCount', label: 'Opens',
      render: r => {
        if (r.channel !== 'email' || !r.sentCount) return <span className="text-xs text-ink-secondary">—</span>
        const opens = r.uniqueOpenCount ?? 0
        const rate  = Math.round((opens / r.sentCount) * 100)
        return (
          <div>
            <p className="text-sm font-semibold text-ink">{opens}</p>
            <p className="text-[11px] text-ink-secondary">{rate}%</p>
          </div>
        )
      },
    },
    {
      key: 'uniqueClickCount', label: 'Clicks',
      render: r => {
        if (r.channel !== 'email' || !r.sentCount) return <span className="text-xs text-ink-secondary">—</span>
        const clicks = r.uniqueClickCount ?? 0
        const rate   = Math.round((clicks / r.sentCount) * 100)
        return (
          <div>
            <p className="text-sm font-semibold text-ink">{clicks}</p>
            <p className="text-[11px] text-ink-secondary">{rate}%</p>
          </div>
        )
      },
    },
    {
      key: 'failedCount', label: 'Failed',
      render: r => r.failedCount
        ? <span className="text-sm font-semibold text-red-500">{r.failedCount}</span>
        : <span className="text-sm text-ink-secondary">0</span>,
    },
    {
      key: 'status', label: 'Status',
      render: r => (
        <div className="flex items-center gap-1.5" onClick={e => (r.status === 'Recurring' || r.status === 'Paused') && e.stopPropagation()}>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status] ?? STATUS_STYLES.Draft}`}>
            {r.status || 'Draft'}
          </span>
          {r.status === 'Recurring' && (
            <button title="Pause recurring campaign"
              onClick={() => updateDoc(doc(db, 'users', uid, 'campaigns', r.id), { status: 'Paused' })}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <Pause size={12} />
            </button>
          )}
          {r.status === 'Paused' && (
            <button title="Resume recurring campaign"
              onClick={() => updateDoc(doc(db, 'users', uid, 'campaigns', r.id), { status: 'Recurring' })}
              className="rounded p-1 text-indigo-400 transition hover:bg-indigo-50 hover:text-indigo-600">
              <Play size={12} />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt', label: 'Date',
      render: r => {
        if ((r.status === 'Recurring' || r.status === 'Paused') && r.nextRunAt) {
          const d = r.nextRunAt.toDate?.()
          return (
            <div>
              <p className="text-xs font-semibold text-indigo-600">
                {r.status === 'Paused' ? 'Paused' : `Next: ${d?.toLocaleDateString('en-ZA') ?? '—'}`}
              </p>
              <p className="text-[11px] text-ink-secondary">
                {r.runCount ? `${r.runCount} run${r.runCount !== 1 ? 's' : ''} so far` : 'no runs yet'}
              </p>
            </div>
          )
        }
        if (r.status === 'Scheduled' && r.scheduledFor) {
          const d = r.scheduledFor.toDate?.()
          return (
            <div>
              <p className="text-xs font-semibold text-blue-600">
                {d?.toLocaleDateString('en-ZA') ?? '—'}
              </p>
              <p className="text-[11px] text-ink-secondary">
                {d?.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) ?? ''}
              </p>
            </div>
          )
        }
        const sent = r.sentAt?.toDate?.() ?? r.createdAt?.toDate?.()
        return <span className="text-xs text-ink-secondary">{sent?.toLocaleDateString('en-ZA') ?? '—'}</span>
      },
    },
  ]

  if (!config) {
    return <p className="text-sm text-slate-500">Campaigns not available for this industry.</p>
  }

  // ── Full-page campaign analytics ───────────────────────────────────────────
  if (viewCampaign) {
    const c          = viewCampaign
    const vcSent     = c.sentCount      ?? 0
    const vcFailed   = c.failedCount    ?? 0
    const vcRecip    = (c.recipientCount ?? (vcSent + vcFailed)) || 0
    const vcOpens    = c.uniqueOpenCount  ?? 0
    const vcClicks   = c.uniqueClickCount ?? 0
    const vcOpenRate  = vcSent  > 0 ? (vcOpens  / vcSent  * 100) : 0
    const vcClickRate = vcSent  > 0 ? (vcClicks / vcSent  * 100) : 0
    const vcDelivRate = vcRecip > 0 ? (vcSent   / vcRecip * 100) : 0
    const isEmail    = c.channel === 'email'
    const isHtml     = c.emailMode === 'html' || c.emailMode === 'unlayer'
    const vcDate     = c.sentAt?.toDate?.() ?? c.createdAt?.toDate?.()
    const chMeta     = CHANNEL_META[c.channel]
    const ChIcon     = chMeta?.icon

    // Funnel steps: each step shows absolute count + % of previous
    const funnel = isEmail
      ? [
          { label: 'Recipients', value: vcRecip, pct: 100,                                    color: 'bg-slate-700' },
          { label: 'Delivered',  value: vcSent,  pct: vcRecip > 0 ? vcDelivRate  : 0,        color: 'bg-primary'  },
          { label: 'Opened',     value: vcOpens, pct: vcSent  > 0 ? vcOpenRate   : 0,        color: 'bg-blue-500' },
          { label: 'Clicked',    value: vcClicks,pct: vcSent  > 0 ? vcClickRate  : 0,        color: 'bg-purple-500' },
        ]
      : [
          { label: 'Recipients', value: vcRecip,  pct: 100,                                  color: 'bg-slate-700' },
          { label: 'Delivered',  value: vcSent,   pct: vcRecip > 0 ? vcDelivRate : 0,        color: 'bg-primary'  },
          { label: 'Failed',     value: vcFailed, pct: vcRecip > 0 ? (vcFailed / vcRecip * 100) : 0, color: 'bg-red-400' },
        ]

    return (
      <div className="-mx-6 -mt-6 flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50/50">

        {/* Top bar */}
        <div className="shrink-0 border-b border-slate-200/60 bg-white px-8 py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewCampaign(null)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
              <ArrowLeft size={15} /> Campaign History
            </button>
            <div className="flex flex-1 min-w-0 items-center gap-3">
              <div className="h-7 w-1 rounded-full bg-primary shrink-0" />
              <span className="truncate text-xl font-bold text-slate-800">
                {c.campaignName || c.subject || 'Campaign'}
              </span>
              {chMeta && ChIcon && (
                <span className={`flex shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-1 text-xs font-semibold ${chMeta.color}`}>
                  <ChIcon size={12} /> {chMeta.label}
                </span>
              )}
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[c.status] ?? STATUS_STYLES.Draft}`}>
                {c.status || 'Draft'}
              </span>
              {vcDate && (
                <span className="text-xs text-slate-400 shrink-0">
                  {vcDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}
                  {vcDate.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <button
              onClick={() => { setViewCampaign(null); loadCampaignIntoWizard(c) }}
              title="Reuse this campaign's audience and content in a new campaign"
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
              <Copy size={14} /> Duplicate
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-8 py-8 space-y-6">

            {/* KPI row */}
            <div className={`grid grid-cols-2 gap-5 ${isEmail ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
              {[
                { label: 'Recipients',     value: vcRecip.toLocaleString('en-ZA'),          sub: 'targeted',            color: 'bg-slate-50 text-slate-600'    },
                { label: 'Delivered',      value: vcSent.toLocaleString('en-ZA'),           sub: `${vcDelivRate.toFixed(1)}% delivery rate`, color: 'bg-green-50 text-green-600'  },
                { label: 'Failed',         value: vcFailed.toLocaleString('en-ZA'),         sub: vcFailed > 0 ? 'check contacts' : 'all good',  color: vcFailed > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400' },
                ...(isEmail ? [
                  { label: 'Open Rate',    value: `${vcOpenRate.toFixed(1)}%`,              sub: `${vcOpens} unique opens`,   color: 'bg-blue-50 text-blue-600'    },
                  { label: 'Click Rate',   value: `${vcClickRate.toFixed(1)}%`,             sub: `${vcClicks} unique clicks`, color: 'bg-purple-50 text-purple-600' },
                ] : []),
                ...(!isEmail ? [
                  { label: 'Delivery Rate', value: `${vcDelivRate.toFixed(1)}%`,            sub: `${vcSent} of ${vcRecip}`,  color: 'bg-primary/5 text-primary'   },
                ] : []),
              ].map(({ label, value, sub, color }) => (
                <div key={label} className={`rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm`}>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                  <p className={`text-3xl font-black tracking-tight ${color.split(' ')[1]}`}>{value}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
                </div>
              ))}
            </div>

            {/* Delivery funnel */}
            <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <p className="mb-5 text-xs font-bold uppercase tracking-widest text-slate-400">
                {isEmail ? 'Email funnel' : 'SMS delivery'}
              </p>
              <div className="space-y-3">
                {funnel.map((step, i) => (
                  <div key={step.label}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">{step.label}</span>
                        {i > 0 && (
                          <span className="text-slate-400">
                            {step.pct.toFixed(1)}% {isEmail && i === 1 ? 'of recipients' : i > 1 ? 'of delivered' : ''}
                          </span>
                        )}
                      </div>
                      <span className="font-black text-slate-800">{step.value.toLocaleString('en-ZA')}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full transition-all ${step.color}`}
                        style={{ width: `${Math.min(100, step.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {isEmail && vcSent > 0 && (
                <div className="mt-4 flex gap-4 text-[11px] text-slate-400 border-t border-slate-100 pt-4">
                  <span>Industry avg open rate: <strong className="text-slate-600">~25%</strong></span>
                  <span>Industry avg CTR: <strong className="text-slate-600">~3%</strong></span>
                  {vcOpenRate > 25 && <span className="font-semibold text-green-600">↑ Above average open rate</span>}
                  {vcClickRate > 3  && <span className="font-semibold text-green-600">↑ Above average CTR</span>}
                </div>
              )}
            </div>

            {/* Message + recipients */}
            <div className="grid gap-5 items-start lg:grid-cols-[1fr_1.6fr]">

              {/* Message preview */}
              <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Message preview</p>
                {c.segmentLabel && (
                  <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <span className="font-semibold">Segment: </span>{c.segmentLabel}
                  </div>
                )}
                {isEmail && isHtml ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    </div>
                    <div className="flex justify-center bg-gray-100 p-4">
                      <iframe srcDoc={c.body} sandbox="allow-same-origin"
                        title="Email preview" className="rounded border border-gray-200 bg-white shadow"
                        style={{ width: 480, height: 360, maxWidth: '100%' }} />
                    </div>
                  </div>
                ) : isEmail ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {c.subject && <p className="mb-2 text-xs font-semibold text-slate-500">Subject: {c.subject}</p>}
                    {c.body}
                  </div>
                ) : (
                  <div className="flex">
                    <div className="max-w-xs rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700">
                      {c.body}
                    </div>
                  </div>
                )}
              </div>

              {/* Recipients */}
              <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Recipients</p>
                  {loadingMsgs
                    ? <Loader2 size={14} className="animate-spin text-slate-300" />
                    : <span className="text-xs text-slate-400">{campaignMsgs.length} records</span>
                  }
                </div>
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-slate-300" />
                  </div>
                ) : campaignMsgs.length === 0 ? (
                  <p className="px-6 py-10 text-center text-xs text-slate-400">No recipient records found.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm">
                        <tr>
                          <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">To</th>
                          <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                          <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Sent at</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {campaignMsgs.map(m => (
                          <tr key={m.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3 font-medium text-slate-700 max-w-[180px] truncate">{m.to || '—'}</td>
                            <td className="px-5 py-3">
                              <span className={`rounded-full px-2.5 py-0.5 font-semibold ${
                                m.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                              }`}>{m.status || '—'}</span>
                            </td>
                            <td className="px-5 py-3 text-slate-400">
                              {m.sentAt?.toDate?.()?.toLocaleString('en-ZA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalSent      = campaigns.reduce((s, c) => s + (c.sentCount ?? 0), 0)
  const sentCampaigns  = campaigns.filter(c => c.status === 'Sent' || c.status === 'Partial').length
  const scheduledCount = campaigns.filter(c => c.status === 'Scheduled').length
  const draftCount     = campaigns.filter(c => c.status === 'Draft').length

  // Engagement across all email campaigns with at least one delivery
  const emailAgg = campaigns.reduce((acc, c) => {
    if (c.channel === 'email' && (c.sentCount ?? 0) > 0) {
      acc.sent   += c.sentCount
      acc.opens  += c.uniqueOpenCount  ?? 0
      acc.clicks += c.uniqueClickCount ?? 0
    }
    return acc
  }, { sent: 0, opens: 0, clicks: 0 })
  const avgOpenRate  = emailAgg.sent > 0 ? (emailAgg.opens  / emailAgg.sent) * 100 : null
  const avgClickRate = emailAgg.sent > 0 ? (emailAgg.clicks / emailAgg.sent) * 100 : null

  // ── Chart data — last 8 weeks ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const now = new Date()
      const monday = new Date(now)
      monday.setDate(now.getDate() - now.getDay() + 1 - (7 - i) * 7)
      monday.setHours(0, 0, 0, 0)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)
      return {
        label: `${monday.getDate()} ${monday.toLocaleString('en-ZA', { month: 'short' })}`,
        start: monday,
        end: sunday,
        sent: 0,
        failed: 0,
      }
    })
    campaigns.forEach(c => {
      const d = c.sentAt?.toDate?.() ?? c.createdAt?.toDate?.()
      if (!d) return
      const w = weeks.find(wk => d >= wk.start && d <= wk.end)
      if (w) { w.sent += c.sentCount ?? 0; w.failed += c.failedCount ?? 0 }
    })
    return weeks
  }, [campaigns])

  const smsChars    = body.length
  const smsSegments = Math.ceil(smsChars / 160) || 1

  // ── Wizard ─────────────────────────────────────────────────────────────────
  if (view === 'wizard') {
    const STEPS = [
      { n: 1, label: 'Channel'  },
      { n: 2, label: 'Audience' },
      { n: 3, label: 'Content'  },
      { n: 4, label: 'Review'   },
    ]
    const step2Ready = sendTo.mode === 'all'
      || (sendTo.mode === 'tagged' && sendTo.tags.length > 0)
      || (sendTo.mode === 'custom' && sendTo.filters.length > 0)
    const step3Ready = emailMode === 'unlayer' ? unlayerReady : !!body.trim()
    const canGoNext  = step === 1 ? !!channel : step === 2 ? step2Ready : step === 3 ? step3Ready : false

    function goNext() { setStep(s => Math.min(s + 1, 4)) }
    function goBack() { if (step === 1) { closeModal() } else { setStep(s => s - 1) } }

    return (
    <div className="-mx-6 -mt-6 flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50/50">

      {/* Step progress bar */}
      <div className="shrink-0 border-b border-slate-200/60 bg-white px-8 py-4">
        <div className="flex items-center gap-6">
          <button onClick={goBack}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
            <ArrowLeft size={15} /> {step === 1 ? 'Campaigns' : 'Back'}
          </button>
          <div className="flex flex-1 items-center justify-center gap-1">
            {STEPS.map((s, i) => {
              const isDone   = step > s.n
              const isActive = step === s.n
              return (
                <div key={s.n} className="flex items-center">
                  <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    isActive ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : isDone ? 'text-primary'
                    : 'text-slate-400'
                  }`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                      isActive ? 'bg-white/20' : isDone ? 'bg-primary/10' : 'bg-slate-100'
                    }`}>
                      {isDone ? '✓' : s.n}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`mx-1 h-px w-8 transition-colors ${step > s.n ? 'bg-primary' : 'bg-slate-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
          {!sending && !done && !scheduled && (
            <button onClick={saveDraft}
              disabled={savingDraft || !(campaignName.trim() || subject.trim() || body.trim())}
              title="Save your progress and finish later"
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
              {savingDraft ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span className="hidden sm:inline">Save draft</span>
            </button>
          )}
          {step < 4 && (
            <button onClick={goNext} disabled={!canGoNext}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
              {step === 3 ? 'Review' : 'Next'} <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">

        {/* ══ STEP 1 · Channel ══════════════════════════════════════════════ */}
        {step === 1 && (
        <div className="mx-auto max-w-xl px-6 py-12">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black text-slate-900">Choose your channel</h2>
            <p className="mt-2 text-sm text-slate-500">How do you want to reach your {config.contactLabel.toLowerCase()}s?</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(CHANNEL_META).map(([key, meta]) => {
              const Icon   = meta.icon
              const active = channel === key
              return (
                <button key={key} type="button"
                  onClick={() => { setChannel(key); setStep(2) }}
                  className={`flex flex-col items-center gap-4 rounded-3xl border-2 p-8 text-center transition-all hover:shadow-xl hover:shadow-slate-200/50 ${
                    active
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                      : 'border-slate-200 bg-white hover:border-primary/50'
                  }`}>
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition ${
                    active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Icon size={30} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-800">{meta.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{meta.description}</p>
                  </div>
                  {active && <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-white">Selected ✓</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-6 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <label className="block">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Campaign name</p>
              <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                placeholder="e.g. June Newsletter, Appointment Reminder…"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
          </div>
          {channel && (
            <div className="mt-6 flex justify-end">
              <button onClick={() => setStep(2)}
                className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d]">
                Continue to Audience <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
        )}

        {/* ══ STEP 2 · Audience ═════════════════════════════════════════════ */}
        {step === 2 && (
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900">Who gets this?</h2>
            <p className="mt-2 text-sm text-slate-500">Select the segment of your {config.contactLabel.toLowerCase()}s to reach.</p>
          </div>
          <div className="space-y-4">
            {/* Saved audiences */}
            {audiences.length > 0 && (
              <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Saved audiences</p>
                <div className="flex flex-wrap gap-2">
                  {audiences.map(a => (
                    <span key={a.id} className="flex items-center overflow-hidden rounded-xl border border-slate-200">
                      <button type="button" onClick={() => applyAudience(a)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-primary/5 hover:text-primary">
                        <Bookmark size={12} /> {a.name}
                      </button>
                      <button type="button" title="Delete audience"
                        onClick={() => {
                          if (window.confirm(`Delete audience "${a.name}"?`)) {
                            deleteDoc(doc(db, 'users', uid, 'audiences', a.id))
                          }
                        }}
                        className="border-l border-slate-200 px-1.5 py-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Mode tabs */}
            <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
              <div className="flex border-b border-slate-200">
                {[
                  { key: 'all',    label: 'All contacts',  icon: Users  },
                  { key: 'tagged', label: 'Tagged',         icon: Tag    },
                  { key: 'custom', label: 'Custom filter',  icon: Filter },
                ].map(mode => {
                  const Icon   = mode.icon
                  const active = sendTo.mode === mode.key
                  return (
                    <button key={mode.key} type="button"
                      onClick={() => setSendTo({ mode: mode.key, tags: [], filters: [] })}
                      className={`flex flex-1 items-center justify-center gap-2 border-r border-slate-200 py-4 text-sm font-semibold transition last:border-0 ${
                        active ? 'bg-primary/10 text-primary font-bold' : 'bg-white text-slate-700 hover:bg-slate-50'
                      }`}>
                      <Icon size={15} /> {mode.label}
                    </button>
                  )
                })}
              </div>
              <div className="p-6">
                {sendTo.mode === 'all' && (
                  <p className="text-sm text-slate-600">All {contacts.length} {config.contactLabel.toLowerCase()}s will be eligible (opted-out contacts are always excluded).</p>
                )}
                {sendTo.mode === 'tagged' && (
                  allTags.length === 0
                    ? <p className="text-sm text-slate-500">No tags found. Add tags to your {config.contactLabel.toLowerCase()}s first.</p>
                    : <>
                        <p className="mb-3 text-sm text-slate-600">Select one or more tags. Contacts matching <strong>any</strong> tag are included.</p>
                        <div className="flex flex-wrap gap-2">
                          {allTags.map(tag => {
                            const active = sendTo.tags.includes(tag)
                            return (
                              <button key={tag} type="button" onClick={() => toggleTag(tag)}
                                className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                                  active ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-700 hover:border-primary/60'
                                }`}>
                                {active && <X size={12} />} {tag}
                              </button>
                            )
                          })}
                        </div>
                      </>
                )}
                {sendTo.mode === 'custom' && (
                  <>
                    <p className="mb-3 text-sm text-slate-600">All selected conditions must match (<strong>AND</strong> logic).</p>
                    <div className="space-y-2">
                      {config.customFilters.map(f => {
                        const active = sendTo.filters.includes(f.key)
                        return (
                          <label key={f.key} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 px-5 py-3.5 text-sm transition hover:bg-slate-50">
                            <input type="checkbox" checked={active} onChange={() => toggleFilter(f.key)} className="h-4 w-4 accent-primary" />
                            <span className="font-medium text-slate-700">{f.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Recipient summary */}
            <div className={`rounded-3xl border p-5 transition-colors ${
              recipients.length > 0 ? 'border-primary/30 bg-primary/10' : 'border-slate-200 bg-white shadow-sm'
            }`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${recipients.length > 0 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <Users size={18} />
                </div>
                <div>
                  <p className={`text-base font-bold ${recipients.length > 0 ? 'text-primary' : 'text-slate-600'}`}>
                    {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} selected
                  </p>
                  {(optedOut > 0 || noContactInfo > 0) && (
                    <p className="text-xs text-slate-500">
                      {optedOut > 0 && `${optedOut} opted out`}
                      {optedOut > 0 && noContactInfo > 0 && ' · '}
                      {noContactInfo > 0 && `${noContactInfo} no ${channel === 'email' ? 'email' : 'phone'}`}
                    </p>
                  )}
                </div>
                {recipients.length > 0 && (
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {recipients.slice(0, 4).map(c => (
                      <span key={c.id} className="rounded-xl border border-primary/20 bg-white px-2.5 py-1 text-xs font-semibold text-primary">{config.getName(c)}</span>
                    ))}
                    {recipients.length > 4 && <span className="rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-slate-400">+{recipients.length - 4}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
          {sendTo.mode !== 'all' && step2Ready && (
            <button type="button" onClick={saveAudience} disabled={savingAudience}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary transition hover:underline disabled:opacity-50">
              {savingAudience ? <Loader2 size={12} className="animate-spin" /> : <Bookmark size={12} />}
              Save this audience for reuse
            </button>
          )}
          <div className="mt-8 flex items-center justify-between">
            <button onClick={() => setStep(1)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:border-primary hover:text-primary">
              <ArrowLeft size={15} /> Channel
            </button>
            <button onClick={() => setStep(3)}
              disabled={!step2Ready}
              className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
              Continue to Content <ChevronRight size={16} />
            </button>
          </div>
        </div>
        )}

        {/* ══ STEP 3 · Content ══════════════════════════════════════════════ */}
        {/* EmailEditor always mounted in wizard so it doesn't remount on back/next */}
        <div style={{ display: step === 3 ? 'block' : 'none' }}>
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900">Craft your {CHANNEL_META[channel]?.label} message</h2>
            <p className="mt-2 text-sm text-slate-500">Write the content your {config.contactLabel.toLowerCase()}s will receive.</p>
          </div>

          {/* Quick template for SMS */}
          {profile?.googleReviewLink && channel === 'sms' && (
            <div className="mb-6 rounded-3xl border border-amber-200/60 bg-white p-6 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Quick template</p>
              <button type="button"
                onClick={() => setBody(`Hi {name}, thank you for choosing us! We'd love your feedback. Please leave us a Google review: ${profile.googleReviewLinkShort || profile.googleReviewLink}`)}
                className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left transition hover:border-amber-400 hover:bg-amber-100">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                  <Star size={18} className="text-amber-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">Google Review Request</p>
                  <p className="text-[11px] text-amber-700">Pre-filled SMS with your review link</p>
                </div>
                <ChevronRight size={14} className="shrink-0 text-amber-500" />
              </button>
            </div>
          )}

          <div className="space-y-5">
            {/* Email-specific fields */}
            {channel === 'email' && (
              <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Email details</p>
                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                    <span>Subject line *</span>
                    <span className={`font-normal tabular-nums ${subject.length > 60 ? 'font-semibold text-amber-600' : 'opacity-60'}`}>{subject.length} / 60</span>
                  </span>
                  <input value={subject} onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. Important update from our practice"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  {subject.length > 60 && <p className="mt-1 text-[11px] text-amber-600">Subject over 60 characters may be truncated.</p>}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                    Preview text <span className="font-normal normal-case opacity-60">— shown in inbox below subject</span>
                  </span>
                  <input value={previewText} onChange={e => setPreviewText(e.target.value)}
                    placeholder="Short summary shown below the subject line…"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </label>
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <Mail size={12} className="shrink-0" />
                  From: <strong className="text-slate-700">{profile?.businessName || profile?.name || 'Your Business'}</strong> via Tlhiso &lt;hello@tlhiso.com&gt;
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Content type</p>
                  <div className="flex overflow-hidden rounded-2xl border border-slate-200">
                    {[
                      { key: 'text',    label: 'Plain text',    icon: FileText },
                      { key: 'html',    label: 'HTML email',    icon: Code     },
                      { key: 'unlayer', label: 'Visual editor', icon: Layers   },
                    ].map(m => {
                      const Icon   = m.icon
                      const active = emailMode === m.key
                      return (
                        <button key={m.key} type="button"
                          onClick={() => { setEmailMode(m.key); setShowPreview(false); setShowTemplates(false) }}
                          className={`flex flex-1 items-center justify-center gap-2 border-r border-slate-200 py-2.5 text-xs font-semibold transition last:border-0 ${
                            active ? 'bg-primary/10 text-primary font-bold' : 'bg-white text-slate-700 hover:bg-slate-50'
                          }`}>
                          <Icon size={13} /> {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {emailMode === 'html' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => htmlFileRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-primary/60 hover:text-primary">
                      <Upload size={13} /> Upload .html
                    </button>
                    <input ref={htmlFileRef} type="file" accept=".html,text/html" className="hidden" onChange={handleHtmlFile} />
                    <div className="relative">
                      <button type="button" onClick={() => setShowTemplates(s => !s)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          showTemplates ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:border-primary/60 hover:text-primary'
                        }`}>
                        <FileText size={13} /> Templates <ChevronDown size={11} />
                      </button>
                      {showTemplates && (
                        <div className="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                          <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50">
                            {['all', 'general', industry, 'mine'].map(cat => (
                              <button key={cat} type="button" onClick={() => setTemplateFilter(cat)}
                                className={`shrink-0 px-3 py-2 text-[11px] font-semibold capitalize transition ${
                                  templateFilter === cat ? 'border-b-2 border-primary bg-white text-primary' : 'text-slate-400 hover:text-slate-700'
                                }`}>
                                {cat === 'all' ? 'All' : cat === 'mine' ? `My templates (${myTemplates.length})` : cat}
                              </button>
                            ))}
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {templateFilter === 'mine' ? (
                              myTemplates.length === 0 ? (
                                <p className="px-4 py-6 text-center text-xs text-slate-400">
                                  No saved templates yet. Write an HTML email, then click "Save as template".
                                </p>
                              ) : (
                                [...myTemplates]
                                  .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
                                  .map(t => (
                                    <div key={t.id} className="flex w-full items-center justify-between px-4 py-2.5 transition hover:bg-slate-50">
                                      <button type="button"
                                        onClick={() => { setBody(t.html); setEmailMode('html'); setShowTemplates(false) }}
                                        className="min-w-0 flex-1 text-left text-xs font-semibold text-slate-700 hover:text-primary">
                                        <span className="block truncate">{t.name}</span>
                                      </button>
                                      <button type="button" title="Delete template"
                                        onClick={() => {
                                          if (window.confirm(`Delete template "${t.name}"?`)) {
                                            deleteDoc(doc(db, 'users', uid, 'emailTemplates', t.id))
                                          }
                                        }}
                                        className="ml-2 shrink-0 rounded-lg p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  ))
                              )
                            ) : (
                              EMAIL_TEMPLATES.filter(t => templateFilter === 'all' || t.category === templateFilter).map(t => (
                                <button key={t.label} type="button"
                                  onClick={() => { setBody(t.html); setEmailMode('html'); setShowTemplates(false) }}
                                  className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-slate-50 hover:text-primary">
                                  <span className="text-xs font-semibold text-slate-700">{t.label}</span>
                                  <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-400">{t.category}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={saveAsTemplate}
                      disabled={!body.trim() || savingTemplate}
                      title="Save this HTML email to your template library"
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                      {savingTemplate ? <Loader2 size={13} className="animate-spin" /> : <BookmarkPlus size={13} />}
                      Save as template
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Unlayer — always mounted, CSS-toggled */}
            <div style={{ display: channel === 'email' && emailMode === 'unlayer' ? 'block' : 'none' }}
              className="overflow-hidden rounded-3xl border border-slate-200/60 shadow-sm">
              {!unlayerReady && (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                  <Loader2 size={16} className="animate-spin" /> Loading editor…
                </div>
              )}
              <EmailEditor
                ref={emailEditorRef}
                onReady={() => setUnlayerReady(true)}
                style={{ minHeight: 600, display: unlayerReady ? 'block' : 'none' }}
                options={{
                  appearance: { theme: 'light', panels: { tools: { dock: 'left' } } },
                  features: { preview: true, imageEditor: false },
                  tools: { image: { enabled: true } },
                }}
              />
            </div>

            {/* Text / HTML body */}
            {!(channel === 'email' && emailMode === 'unlayer') && (
              <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {channel === 'email' && emailMode === 'html' ? 'HTML code' : 'Message body'}
                  </p>
                  <span className="text-[11px] text-slate-600">
                    {body.length} chars
                    {channel === 'sms' && body.length > 160 && <span className="ml-2 font-semibold text-amber-600">· {smsSegments} SMS parts</span>}
                  </span>
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={channel === 'email' && emailMode === 'html' ? 18 : 10}
                  placeholder={channel === 'email' && emailMode === 'html' ? '<!DOCTYPE html>\n<html>…paste or upload your HTML here…</html>' : 'Type your message here…'}
                  className={`w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                    channel === 'email' && emailMode === 'html' ? 'font-mono text-xs leading-relaxed' : ''
                  }`}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">Insert merge tag:</span>
                  {(config.mergeTags ?? ['{name}']).map(tag => (
                    <button key={tag} type="button" onClick={() => insertMergeTag(tag)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700 transition hover:border-primary/60 hover:bg-primary/5 hover:text-primary">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button onClick={() => setStep(2)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:border-primary hover:text-primary">
              <ArrowLeft size={15} /> Audience
            </button>
            <button onClick={() => setStep(4)}
              disabled={!step3Ready}
              className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
              Review &amp; Send <ChevronRight size={16} />
            </button>
          </div>
        </div>
        </div>

        {/* ══ STEP 4 · Review & Send ════════════════════════════════════════ */}
        {step === 4 && (
        <div className="mx-auto max-w-4xl px-6 py-12">

          {/* Done */}
          {done && !scheduled && (
            <div className="mx-auto max-w-md space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-green-50">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Campaign Sent!</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Successfully sent to <strong className="text-green-700">{progress.sent}</strong> {config.contactLabel.toLowerCase()}{progress.sent !== 1 ? 's' : ''}.
                  {progress.failed > 0 && <> <strong className="text-red-600">{progress.failed}</strong> failed.</>}
                </p>
              </div>
              <button onClick={closeModal}
                className="mx-auto flex items-center gap-2 rounded-2xl bg-primary px-10 py-4 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d]">
                Back to Campaigns
              </button>
            </div>
          )}

          {/* Scheduled */}
          {scheduled && (
            <div className="mx-auto max-w-md space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50">
                <Clock size={40} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  {sendMode === 'recurring' ? 'Recurring Campaign Active!' : 'Campaign Scheduled!'}
                </h2>
                {sendMode === 'recurring' ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Will send to your selected audience{' '}
                    <strong className="text-slate-700">
                      every {recurFreq === 'weekly' ? WEEKDAYS[Number(recurDay)] : `month on the ${recurDay}th`} at {recurTime}
                    </strong>. Pause any time from Campaign History.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    Will send to <strong>{recipients.length}</strong> {config.contactLabel.toLowerCase()}{recipients.length !== 1 ? 's' : ''} on{' '}
                    <strong className="text-slate-700">{scheduledDate} at {scheduledTime}</strong>.
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">Sent automatically within 5 minutes of the scheduled time.</p>
              </div>
              <button onClick={closeModal}
                className="mx-auto flex items-center gap-2 rounded-2xl bg-primary px-10 py-4 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d]">
                Back to Campaigns
              </button>
            </div>
          )}

          {/* Sending */}
          {!done && !scheduled && sending && (
            <div className="mx-auto max-w-md space-y-6">
              <div className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm space-y-5 text-center">
                <Loader2 size={36} className="mx-auto animate-spin text-primary" />
                <div>
                  <p className="text-lg font-bold text-slate-800">Sending campaign…</p>
                  <p className="text-sm text-slate-500">{progress.sent + progress.failed} of {progress.total} processed</p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress.total ? ((progress.sent + progress.failed) / progress.total) * 100 : 0}%` }} />
                </div>
                <div className="flex justify-center gap-6 text-sm font-semibold">
                  <span className="text-green-600">✓ {progress.sent} sent</span>
                  {progress.failed > 0 && <span className="text-red-500">✗ {progress.failed} failed</span>}
                </div>
              </div>
            </div>
          )}

          {/* Normal review */}
          {!done && !scheduled && !sending && (
            <div className="grid gap-6 items-start lg:grid-cols-[1fr_22rem]">

              {/* Left: summary + preview */}
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Campaign summary</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const meta = CHANNEL_META[channel]
                      const Icon = meta?.icon
                      return (
                        <span className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold ${meta?.color}`}>
                          {Icon && <Icon size={14} />} {meta?.label}
                        </span>
                      )
                    })()}
                    <span className="rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
                      {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {(campaignName || (channel === 'email' && subject)) && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{channel === 'email' ? 'Subject' : 'Campaign'}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-800">{channel === 'email' ? subject : campaignName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Audience</p>
                    <p className="mt-0.5 text-sm text-slate-700">{buildSegmentLabel()}</p>
                  </div>
                </div>

                {channel === 'email' && emailMode !== 'unlayer' && body.trim() && (
                  <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200/60 px-6 py-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Email preview</span>
                      <div className="flex overflow-hidden rounded-xl border border-slate-200">
                        {[{ key: 'desktop', icon: Monitor, label: 'Desktop' }, { key: 'mobile', icon: Smartphone, label: 'Mobile' }].map(d => {
                          const Icon = d.icon; const active = previewDevice === d.key
                          return (
                            <button key={d.key} type="button" onClick={() => setPreviewDevice(d.key)}
                              className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold transition ${active ? 'bg-primary text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                              <Icon size={10} /> {d.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="overflow-auto bg-slate-100 p-4">
                      <iframe srcDoc={buildPreviewHtml()} sandbox="allow-same-origin" title="Email preview"
                        className="mx-auto block rounded-xl border border-slate-200 bg-white shadow-sm"
                        style={{ width: previewDevice === 'desktop' ? '100%' : 320, height: 400, maxWidth: '100%' }} />
                    </div>
                  </div>
                )}

                {(channel === 'sms' || channel === 'whatsapp') && body.trim() && (
                  <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                    <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Message preview</p>
                    <div className="flex flex-col items-end gap-2">
                      <div className={`max-w-[85%] rounded-2xl rounded-br-sm px-5 py-3 text-sm text-white ${channel === 'whatsapp' ? 'bg-[#25D366]' : 'bg-primary'}`}>
                        {body}
                      </div>
                      <span className="text-[10px] text-slate-400">{smsChars} chars{channel === 'sms' && smsSegments > 1 && ` · ${smsSegments} parts`}</span>
                    </div>
                  </div>
                )}

                <button onClick={() => setStep(3)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-primary">
                  <ArrowLeft size={14} /> Edit content
                </button>
              </div>

              {/* Right: send controls */}
              <div className="space-y-4">
                {channel === 'email' && (
                  <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm space-y-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                      <Send size={12} /> Send test email
                    </p>
                    <div className="flex gap-2">
                      <input type="email" value={testEmailAddr}
                        onChange={e => { setTestEmailAddr(e.target.value); setTestSent(null) }}
                        placeholder="you@example.com"
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                      <button type="button" onClick={sendTestEmail}
                        disabled={!testEmailAddr.trim() || sendingTest || !body.trim()}
                        className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40">
                        {sendingTest ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        {sendingTest ? 'Sending…' : 'Test'}
                      </button>
                    </div>
                    {testSent === 'success' && <p className="flex items-center gap-1.5 text-xs font-semibold text-green-600"><CheckCircle size={13} /> Test sent to {testEmailAddr}</p>}
                    {testSent === 'error' && <p className="flex items-center gap-1.5 text-xs font-semibold text-red-500"><AlertTriangle size={13} /> Failed to send test.</p>}
                  </div>
                )}

                <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">When to send</p>
                  <div className="flex overflow-hidden rounded-2xl border border-slate-200">
                    {[{ key: 'now', label: 'Send now', icon: Send }, { key: 'later', label: 'Schedule', icon: Clock }, { key: 'recurring', label: 'Repeat', icon: Repeat }].map(m => {
                      const Icon = m.icon; const active = sendMode === m.key
                      return (
                        <button key={m.key} type="button" onClick={() => { setSendMode(m.key); setQuotaError(null) }}
                          className={`flex flex-1 items-center justify-center gap-1.5 border-r border-slate-200 py-2.5 text-xs font-semibold transition last:border-0 ${active ? 'bg-primary/10 text-primary font-bold' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                          <Icon size={13} /> {m.label}
                        </button>
                      )
                    })}
                  </div>
                  {sendMode === 'later' && (
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Calendar size={12} /> Date</span>
                        <input type="date" value={scheduledDate} min={new Date().toISOString().slice(0, 10)}
                          onChange={e => { setScheduledDate(e.target.value); setQuotaError(null) }}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Clock size={12} /> Time</span>
                        <input type="time" value={scheduledTime}
                          onChange={e => { setScheduledTime(e.target.value); setQuotaError(null) }}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                      </label>
                    </div>
                  )}
                  {sendMode === 'recurring' && (
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-500">Frequency</span>
                        <select value={recurFreq}
                          onChange={e => { setRecurFreq(e.target.value); setRecurDay(1) }}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                          <option value="weekly">Every week</option>
                          <option value="monthly">Every month</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                          {recurFreq === 'weekly' ? 'Day of week' : 'Day of month'}
                        </span>
                        {recurFreq === 'weekly' ? (
                          <select value={recurDay} onChange={e => setRecurDay(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                          </select>
                        ) : (
                          <select value={recurDay} onChange={e => setRecurDay(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(d =>
                              <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</option>)}
                          </select>
                        )}
                      </label>
                      <label className="block">
                        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Clock size={12} /> Time</span>
                        <input type="time" value={recurTime} onChange={e => setRecurTime(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                      </label>
                      <p className="rounded-xl bg-indigo-50 px-3 py-2 text-[11px] leading-relaxed text-indigo-700">
                        The audience is re-checked before every run, so new contacts are included
                        automatically. Each run uses your monthly quota. Pause any time from Campaign History.
                      </p>
                    </div>
                  )}
                </div>

                {quotaError && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-xs leading-relaxed text-red-700">{quotaError}</p>
                  </div>
                )}

                {(() => {
                  const p   = PLANS[profile?.plan] ?? PLANS.starter
                  const u   = profile?.messagesUsed ?? 0
                  const pct = Math.min(100, Math.round((u / (p.messages || 1)) * 100))
                  return (
                    <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm">
                      <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        <span>Monthly quota</span><span>{u.toLocaleString()} / {p.messages.toLocaleString()}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })()}

                {sendMode === 'now' && (
                  <button onClick={sendNow}
                    disabled={!(emailMode === 'unlayer' ? unlayerReady : body.trim()) || recipients.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#4e7d6d] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40">
                    <Send size={15} />
                    Send now to {recipients.length} {config.contactLabel.toLowerCase()}{recipients.length !== 1 ? 's' : ''}
                  </button>
                )}
                {sendMode === 'later' && (
                  <button onClick={scheduleLater}
                    disabled={!(emailMode === 'unlayer' ? unlayerReady : body.trim()) || recipients.length === 0 || !scheduledDate || !scheduledTime}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40">
                    <Clock size={15} />
                    Schedule for {scheduledDate || '…'} at {scheduledTime}
                  </button>
                )}
                {sendMode === 'recurring' && (
                  <button onClick={startRecurring}
                    disabled={!(emailMode === 'unlayer' ? unlayerReady : body.trim()) || recipients.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40">
                    <Repeat size={15} />
                    Start {recurFreq} campaign
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        )}

      </div>
    </div>
    )
  }
  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Campaigns</h2>
          <p className="mt-1 text-sm text-slate-400 font-medium">
            Send targeted messages to your {config.contactLabel.toLowerCase()}s via SMS or Email.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!profile?.googleReviewLink) { alert('Please add your Google Review link in Profile settings first.'); return }
              setReviewModal(true); setReviewContact(null); setReviewSearch(''); setReviewDone(false)
            }}
            className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
            title={profile?.googleReviewLink ? 'Send a Google Review request to one contact' : 'Add a Google Review link in Profile first'}>
            <Star size={15} /> Request Reviews
          </button>
          <button onClick={openModal}
            className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-[#4e7d6d]">
            <PlusCircle size={15} /> New Campaign
          </button>
        </div>
      </div>

      {/* Quota bar */}
      <div className="rounded-3xl border border-slate-200/60 bg-white px-8 py-6 shadow-sm">
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {planKey.charAt(0).toUpperCase() + planKey.slice(1)} Plan Quota
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {used.toLocaleString('en-ZA')} / {planLimit.toLocaleString('en-ZA')} messages
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  used / planLimit > 0.9 ? 'bg-red-500' : used / planLimit > 0.7 ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.min((used / planLimit) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-black tracking-tight text-slate-900">{remaining.toLocaleString('en-ZA')}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">remaining</p>
            <button onClick={() => setTopupOpen(true)}
              className="mt-2 flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/10">
              <CreditCard size={12} /> Top up
            </button>
          </div>
        </div>
      </div>

      {/* Top-up modal */}
      {topupOpen && (
        <Modal open onClose={() => !topupBuying && setTopupOpen(false)} title="Buy extra campaign messages">
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Top-ups are added to this month's quota instantly after payment and never expire mid-month.
            </p>
            {TOPUP_BUNDLES.map(b => (
              <button key={b.key} onClick={() => buyTopup(b.key)} disabled={!!topupBuying}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-5 py-4 text-left transition hover:border-primary hover:bg-primary/5 disabled:opacity-50">
                <div>
                  <p className="text-sm font-bold text-slate-800">{b.messages.toLocaleString('en-ZA')} messages</p>
                  <p className="text-xs text-slate-400">R{(b.price / b.messages).toFixed(2)} per message</p>
                </div>
                <span className="flex items-center gap-2 text-base font-black text-primary">
                  {topupBuying === b.key ? <Loader2 size={16} className="animate-spin" /> : `R${b.price.toLocaleString('en-ZA')}`}
                </span>
              </button>
            ))}
            <p className="text-center text-[11px] text-slate-400">
              Secure payment by PayFast — cards, Instant EFT &amp; Google Pay.
            </p>
          </div>
        </Modal>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 sm:gap-6">
        <div className="group rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40 cursor-default">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Campaigns</p>
          <p className="text-3xl font-black tracking-tight text-slate-900">{campaigns.length}</p>
          <p className="mt-2 text-xs font-medium text-slate-400">
            {sentCampaigns} sent{draftCount > 0 ? ` · ${draftCount} draft${draftCount !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="group rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40 cursor-default">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Messages Sent</p>
          <p className="text-3xl font-black tracking-tight text-primary">{totalSent.toLocaleString('en-ZA')}</p>
          <p className="mt-2 text-xs font-medium text-slate-400">across all campaigns</p>
        </div>
        <div className="group rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40 cursor-default">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Avg Open Rate</p>
          <p className="text-3xl font-black tracking-tight text-blue-600">
            {avgOpenRate !== null ? `${avgOpenRate.toFixed(1)}%` : '—'}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-400">
            {avgOpenRate !== null ? `${emailAgg.opens.toLocaleString('en-ZA')} unique opens` : 'no email campaigns yet'}
          </p>
        </div>
        <div className="group rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40 cursor-default">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Avg Click Rate</p>
          <p className="text-3xl font-black tracking-tight text-purple-600">
            {avgClickRate !== null ? `${avgClickRate.toFixed(1)}%` : '—'}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-400">
            {avgClickRate !== null ? `${emailAgg.clicks.toLocaleString('en-ZA')} unique clicks` : 'no email campaigns yet'}
          </p>
        </div>
        <div className="group rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40 cursor-default">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Scheduled</p>
          <p className="text-3xl font-black tracking-tight text-blue-600">{scheduledCount}</p>
          <p className="mt-2 text-xs font-medium text-slate-400">
            {contacts.length} {config.contactLabel.toLowerCase()}s in base
          </p>
        </div>
      </div>

      {/* Performance chart */}
      {campaigns.length > 0 && (
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Campaign Analytics</h3>
              <p className="text-xs font-medium text-slate-400">Messages sent — last 8 weeks</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/50 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-primary" /> Sent
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/50 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-red-400" /> Failed
              </div>
            </div>
          </div>
          <div className="px-8 py-6">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={2} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="sent"   name="Sent"   fill="#5C9E8A" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="failed" name="Failed" fill="#f87171" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Review-request modal */}
      {reviewModal && (
        <Modal open onClose={() => { setReviewModal(false); setReviewContact(null); setReviewSearch(''); setReviewDone(false) }} title="Request a Google Review">
          {reviewDone ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <p className="font-bold text-slate-800">Review request sent!</p>
              <p className="text-sm text-slate-500">Sent to {config.getName(reviewContact)}.</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => { setReviewContact(null); setReviewSearch(''); setReviewDone(false) }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Send another
                </button>
                <button
                  onClick={() => { setReviewModal(false); setReviewContact(null); setReviewSearch(''); setReviewDone(false) }}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
                  Done
                </button>
              </div>
            </div>
          ) : reviewContact ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {(config.getName(reviewContact) || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{config.getName(reviewContact)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {normalizeSAPhone(reviewContact.phone)
                      ? `SMS → ${normalizeSAPhone(reviewContact.phone)}`
                      : reviewContact.email
                        ? `Email → ${reviewContact.email}`
                        : 'No phone or email on record'}
                  </p>
                </div>
                <button onClick={() => setReviewContact(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-600">Message preview</p>
                Hi {(config.getName(reviewContact) || 'there').split(' ')[0]}, thank you for choosing us! We'd love your feedback. Please leave us a Google review: {profile?.googleReviewLinkShort || profile?.googleReviewLink}
              </div>
              <button
                onClick={sendReviewToContact}
                disabled={reviewSending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-50">
                {reviewSending
                  ? <><Loader2 size={15} className="animate-spin" /> Sending…</>
                  : <><Star size={14} /> Send Review Request</>}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                value={reviewSearch}
                onChange={e => setReviewSearch(e.target.value)}
                placeholder={`Search ${config.contactLabel.toLowerCase()}s…`}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {contacts
                  .filter(c => {
                    const q = reviewSearch.toLowerCase()
                    return !q || config.getName(c).toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q)
                  })
                  .slice(0, 20)
                  .map(c => (
                    <button key={c.id} type="button" onClick={() => setReviewContact(c)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(config.getName(c) || '?').charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{config.getName(c)}</p>
                        <p className="truncate text-xs text-slate-500">{c.phone || c.email || '—'}</p>
                      </div>
                    </button>
                  ))
                }
                {contacts.filter(c => {
                  const q = reviewSearch.toLowerCase()
                  return !q || config.getName(c).toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q)
                }).length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">No contacts found.</p>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* History table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Campaign History</h3>
            <p className="text-xs font-medium text-slate-400">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total</p>
          </div>
          <button onClick={openModal}
            className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition hover:bg-primary/20">
            + NEW
          </button>
        </div>
        <DataTable
          columns={cols}
          data={sortedCampaigns}
          onRowClick={r => r.status === 'Draft' ? loadCampaignIntoWizard(r, r.id) : openDetail(r)}
          emptyMessage={`No campaigns yet. Click "New Campaign" to get started.`}
        />
      </div>


    </div>
  )
}
