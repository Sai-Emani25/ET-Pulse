import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function getPersonalizedFeed(persona: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Fetch the latest top business news from Economic Times (ET) and other major business sources. 
    Format them for a ${persona} persona. 
    Provide a list of 6-8 relevant news stories.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            category: { type: Type.STRING },
            timestamp: { type: Type.STRING },
            source: { type: Type.STRING },
            url: { type: Type.STRING }
          },
          required: ["id", "title", "summary", "category", "timestamp", "source"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse feed", e);
    return [];
  }
}

export async function getStoryBriefing(storyTitle: string, persona: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create an interactive intelligence briefing for the story: "${storyTitle}".
    Tailor the insights for a ${persona}.
    Include a synthesis of multiple perspectives, key takeaways, and a brief timeline if applicable.
    Also provide 3 follow-up questions the user might ask.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overview: { type: Type.STRING },
          keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
          personaInsight: { type: Type.STRING },
          timeline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                event: { type: Type.STRING }
              }
            }
          },
          relatedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["overview", "keyTakeaways", "personaInsight", "relatedQuestions"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse briefing", e);
    return null;
  }
}

export async function askFollowUp(question: string, context: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Context: ${context}\n\nQuestion: ${question}\n\nProvide a concise, expert answer.`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });
  return response.text;
}

export async function generateNarration(text: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say professionally and clearly: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Fenrir' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    return `data:audio/mp3;base64,${base64Audio}`;
  }
  return null;
}

export async function startVideoGeneration(prompt: string) {
  const response = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `A broadcast-quality news visual: ${prompt}. Cinematic lighting, professional business news aesthetic.`,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });
  return response;
}

export async function pollVideoStatus(operation: any) {
  const status = await ai.operations.getVideosOperation({ operation });
  return status;
}

export async function fetchVideoBlob(uri: string) {
  const response = await fetch(uri, {
    method: 'GET',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY!,
    },
  });
  return await response.blob();
}

export async function generatePPTPrompt(briefing: Briefing, persona: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this intelligence briefing, create a 7-slide professional PowerPoint presentation outline.
    
    Briefing Overview: ${briefing.overview}
    Key Takeaways: ${briefing.keyTakeaways.join(", ")}
    Persona: ${persona}
    
    For each slide, provide:
    1. Slide Title
    2. 3-4 concise bullet points
    3. A 'Speaker Note' that adds strategic depth and context.
    
    Format the output as a structured outline.`,
  });
  return response.text;
}
