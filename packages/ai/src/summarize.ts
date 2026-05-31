import { groq } from "./groq";

export async function summarizeTranscript(
  transcript: string
) {
  // Use Groq with Llama 3.3 70B for fast, free summarization
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "You are an expert video analyst. Always respond with valid JSON only."
      },
      {
        role: "user",
        content: `Analyze the following video transcript and return a JSON response with:
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
}`
      }
    ],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Failed to generate summary from Groq");
  }

  return content;
}