import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION_TEMPLATE } from "../constants";

export const JSON_SCHEMA = {
  type: Type.ARRAY,
  description: "An array where each object represents a single laboratory request form to be generated.",
  items: {
    type: Type.OBJECT,
    description: "Details for a single lab request form.",
    properties: {
      "name": { type: Type.STRING, description: "Patient's full name (LAST, FIRST MI). Must be in all caps." },
      "ward_location": { type: Type.STRING, description: "Ward location (e.g., ICU 3, Room 102)." },
      "age_sex": { type: Type.STRING, description: "Patient's age and sex, combined (e.g., '45/F' or '72/M')." },
      "birthday": { type: Type.STRING, description: "Patient's date of birth (MM-DD-YYYY)." },
      "case_number": { type: Type.STRING, description: "Patient's unique case or chart number." },
      "diagnosis": { type: Type.STRING, description: "Primary provisional or admitting diagnosis. Should be brief." },
      "requested_by": { type: Type.STRING, description: "Name of the ordering physician/requester (e.g., Dr. Smith)." },
      "date_collected": { type: Type.STRING, description: "Date specimen was collected (MM-DD)." },
      "time_collected": { type: Type.STRING, description: "Time specimen was collected (HH:MM am/pm)." },
      "collected_by": { type: Type.STRING, description: "Name or initials of the person who collected the specimen (e.g., Nurse J. Doe)." },
      "specimen_type": { type: Type.STRING, description: "Type of specimen (e.g., Blood, Urine, Sputum, Swab, Pleural Fluid, ETA)." },
      "site_of_collection": { type: Type.STRING, description: "Anatomical or procedural site (e.g., Venipuncture, Mid-Stream, Thoracentesis)." },
      "form_type": { type: Type.STRING, description: "The specific laboratory section/test category this request belongs to (e.g., Hematology, Chemistry, Urinalysis, Culture, Special)." },
      "tube_top": { type: Type.STRING, description: "Color of the tube top required for this test. Use 'N/A' for non-tube specimens (like Urine, Sputum, etc.). (e.g., Purple, Red, Blue, N/A)." },
      "requests_list": { type: Type.STRING, description: "A comma-separated list of the specific tests requested on this form (e.g., 'CBC, Platelet Count')." }
    },
    required: ["name", "age_sex", "case_number", "date_collected", "specimen_type", "form_type", "requests_list"]
  }
};

export async function extractLabData(text: string, collector: string, date: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";

  const systemInstruction = SYSTEM_INSTRUCTION_TEMPLATE
    .replace("__COLLECTOR_DEFAULT__", collector || "")
    .replace("__DATE_DEFAULT__", date);

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: JSON_SCHEMA,
    },
  });

  return JSON.parse(response.text || "[]");
}
