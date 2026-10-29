// Muhammed Safwan's profile — used as system context for Gemini email generation.
// Sourced directly from C:\Users\amrin\Documents\SAFWAN-RESUME.pdf

export const MY_PROFILE = {
  name: "Muhammed Safwan",
  email: "mesafwan07@gmail.com",
  phone: "+91 9620525547",
  role: "Full Stack Developer",
  location: "Bengaluru, Karnataka, India",
  education:
    "Bachelor of Commerce in Computer Applications, Mangalore University (2022–2025)",
  experience:
    "Freelance Full Stack Developer at Projextly (built and maintained commercial platforms with Next.js, TypeScript, Prisma, PostgreSQL, Razorpay, Turborepo); Full Stack Developer Intern at Supperb (production web apps with Next.js, TypeScript, Node.js, OAuth & Vercel CI/CD); Creator of Playform (player registration & tournament platform).",
  techStack: [
    "Next.js",
    "React.js",
    "TypeScript",
    "Node.js",
    "Express.js",
    "PostgreSQL",
    "Prisma",
    "MongoDB",
    "Redis",
    "Docker",
    "Tailwind CSS",
    "REST APIs",
    "WebSockets",
  ],
  portfolioUrl: "https://drive.google.com/file/d/1F0G0wM91fEoH-l9P_nzDitqvPEJ6T-aH/view?usp=sharing",
  resumeDriveUrl:
    "https://drive.google.com/file/d/1F0G0wM91fEoH-l9P_nzDitqvPEJ6T-aH/view?usp=sharing",
  resumeLocalPath: "C:\\Users\\amrin\\Documents\\SAFWAN-RESUME.pdf",
  resumeFileName: "SAFWAN-RESUME.pdf",
  signOff: `Best regards,\nMuhammed Safwan\nFull Stack Developer\nBengaluru, India\n+91 9620525547 | mesafwan07@gmail.com`,
} as const;

export type MyProfile = typeof MY_PROFILE;
