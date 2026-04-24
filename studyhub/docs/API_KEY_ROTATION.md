# API Key Rotation Guide

## Overview

This document provides instructions for rotating API keys used by StudyHub. Regular key rotation is a security best practice to limit the impact of compromised credentials.

## Keys That Need Rotation

### 1. Firebase Keys
| Key | Type | Risk Level | Rotation Difficulty |
|-----|------|------------|---------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public | Medium | Easy |
| `FIREBASE_PRIVATE_KEY` | Secret | **High** | Medium |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Public | Low | Easy |

### 2. Database Keys
| Key | Risk Level | Rotation Difficulty |
|-----|------------|---------------------|
| `DATABASE_URL` | **Critical** | Hard |

### 3. AI Service Keys
| Key | Risk Level | Rotation Difficulty |
|-----|------------|---------------------|
| `OPENROUTER_API_KEY` | **High** | Easy |
| `GROQ_API_KEY` | **High** | Easy |

### 4. Email Keys
| Key | Risk Level | Rotation Difficulty |
|-----|------------|---------------------|
| `SMTP_PASS` | Medium | Easy |
| `RESEND_API_KEY` | Medium | Easy |

### 5. Analytics Keys
| Key | Risk Level | Rotation Difficulty |
|-----|------------|---------------------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Low | Easy |
| `POSTHOG_API_KEY` | Medium | Easy |

---

## Rotation Procedures

### Firebase (Recommended: Quarterly)

1. **Firebase Console**: https://console.firebase.google.com/project/studyhub-8e93e/settings/general

2. **For `NEXT_PUBLIC_FIREBASE_API_KEY`**:
   - Go to Project Settings > Your apps > Web app
   - Copy the new API Key
   - Update in Vercel Environment Variables

3. **For `FIREBASE_PRIVATE_KEY`** (Service Account):
   - Go to Project Settings > Service accounts
   - Click "Generate new private key"
   - Save the JSON file securely
   - Update `FIREBASE_PRIVATE_KEY` in Vercel (copy from JSON, escape newlines)

4. **For reCAPTCHA (App Check)**:
   - Go to https://console.cloud.google.com/security/recaptcha
   - Create new key or rotate existing
   - Update `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`

### Database (Recommended: Annually)

1. **Supabase Dashboard**: https://supabase.com/dashboard/project/_/settings/database

2. Update `DATABASE_URL` and `DIRECT_URL` with new credentials

### AI Services (Recommended: Monthly)

1. **OpenRouter**: https://openrouter.ai/keys
2. **Groq**: https://console.groq.com/keys

### Email (Recommended: Every 6 Months)

1. **Gmail App Password**: Generate new at https://myaccount.google.com/apppasswords
2. **Resend**: https://resend.com/api-keys

### PostHog (Recommended: When compromised)

1. https://app.posthog.com/settings/project → API Keys → Create new key

---

## Emergency Rotation (When Compromised)

If you suspect a key has been compromised:

1. **Immediately rotate** the key in the provider console
2. **Update in Vercel** Environment Variables
3. **Redeploy** to apply changes
4. **Monitor** for suspicious activity

## Vercel Environment Variables Update

```bash
# Using Vercel CLI
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
# Enter new value when prompted

# Or update existing
vercel env pull .env.local  # Get current vars
# Edit .env.local with new values
vercel env add .env.local production
```

Or via Dashboard:
1. https://vercel.com/dashboard → Project → Settings → Environment Variables
2. Find the key → Click Edit → Enter new value → Save

---

## Rotation Schedule

| Key | Schedule | Owner |
|-----|----------|-------|
| Database | Annually | Admin |
| AI Keys | Monthly | Admin |
| Firebase Private | Quarterly | Admin |
| Email Keys | Every 6 months | Admin |
| PostHog | When compromised | Admin |

---

## Verification After Rotation

After rotating any key:

1. Test login flow
2. Test email sending
3. Test Firebase notifications
4. Test AI features
5. Check Vercel deployment logs for errors

---

## Documentation

Keep this document updated whenever keys are rotated:
- Date of rotation
- Who performed it
- Reason (scheduled/emergency)
- Any issues encountered
