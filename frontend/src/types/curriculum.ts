import { SemanticChunkData } from "../components/AdaptiveChunkReader";

export interface TopicModule {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  estimatedMinutes: number;
  chunks: SemanticChunkData[];
}

