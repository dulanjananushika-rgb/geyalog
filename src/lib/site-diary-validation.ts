import { z } from 'zod';

export const siteDiarySchema = z.object({
  diaryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date in YYYY-MM-DD format'),
  weather: z.enum(['sunny', 'cloudy', 'rainy', 'heavy_rain', 'windy']),
  workCompleted: z.string().trim().min(3, 'Work completed summary is required').max(3000),
  issuesOrDelays: z.string().trim().max(3000).optional().or(z.literal('')),
  workersCount: z.coerce.number().int().min(0, 'Workers count cannot be negative').default(0),
  visitors: z.string().trim().max(1000).optional().or(z.literal('')),
});

export type SiteDiaryInput = z.infer<typeof siteDiarySchema>;
