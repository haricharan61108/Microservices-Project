import { genAI } from "./openai";

export async function summarizeTranscript(
  transcript: string
) {
  // Use Gemini 1.5 Flash for fast, cost-effective summarization
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    }
  });

  const prompt = `You are an expert video analyst.

Analyze the following video transcript and return a JSON response with:
- title: A concise, descriptive title for the video
- shortSummary: A brief 2-3 sentence summary
- keyPoints: An array of the main points discussed

Transcript:
${transcript}

Return JSON in this format:
{
  "title":"",
  "shortSummary":"",
  "keyPoints":[]
}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const content = response.text();

  if (!content) {
    throw new Error("Failed to generate summary from Gemini");
  }

  return content;
}