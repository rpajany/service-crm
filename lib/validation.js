import { z } from "zod";

const optionalText = (max) =>
  z.string().trim().max(max).optional().default("");

export const companyOnboardingSchema = z.object({
  setupKey: z.string().min(1).max(300),
  company: z.object({
    name: z.string().trim().min(2).max(150),
    slug: z.string().trim().toLowerCase().min(2).max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().min(5).max(30),
    address: z.object({
      street: optionalText(200),
      city: optionalText(100),
      state: optionalText(100),
      postalCode: optionalText(20),
      country: optionalText(100)
    }).optional().default({}),
    website: optionalText(2048),
    gstNumber: optionalText(50)
  }),
  admin: z.object({
    fullName: z.string().trim().min(2).max(120),
    username: z.string().trim().toLowerCase().min(3).max(40)
      .regex(/^[a-z0-9._-]+$/),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(12).max(128)
  })
});

export const loginSchema = z.object({
  companySlug: z.string().trim().toLowerCase().min(2).max(100),
  username: z.string().trim().toLowerCase().min(3).max(40),
  password: z.string().min(1).max(128)
});

export const companyProfileSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(5).max(30),
  address: z.object({
    street: optionalText(200),
    city: optionalText(100),
    state: optionalText(100),
    postalCode: optionalText(20),
    country: optionalText(100)
  }),
  website: optionalText(2048),
  gstNumber: optionalText(50),
  // Data URLs for 1 MB images need more than 1 MB of base64 text.
  logoUrl: optionalText(1_400_000),
  companySealUrl: optionalText(1_400_000)
});

// Return field paths such as company.name and admin.email, including nested errors.
export function formatValidationDetails(error) {
  const fieldErrors = {};
  const formErrors = [];
  for (const issue of error.issues || []) {
    const path = issue.path?.length ? issue.path.join(".") : "_form";
    if (path === "_form") formErrors.push(issue.message);
    else {
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
  }
  return { formErrors, fieldErrors };
}
