import { Embeddings } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { Document } from '@langchain/core/documents';

export interface MemoryVector {
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export class MemoryVectorStore extends VectorStore {
  memoryVectors: MemoryVector[] = [];

  _vectorstoreType(): string {
    return 'memory';
  }

  constructor(embeddings: Embeddings) {
    super(embeddings, {});
  }

  async addDocuments(documents: Document[]): Promise<string[] | void> {
    const texts = documents.map((doc) => doc.pageContent);
    const embeddings = await this.embeddings.embedDocuments(texts);
    for (let i = 0; i < documents.length; i += 1) {
      this.memoryVectors.push({
        content: documents[i].pageContent,
        embedding: embeddings[i],
        metadata: documents[i].metadata,
      });
    }
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<string[] | void> {
    for (let i = 0; i < documents.length; i += 1) {
      this.memoryVectors.push({
        content: documents[i].pageContent,
        embedding: vectors[i],
        metadata: documents[i].metadata,
      });
    }
  }

  async deleteDocuments(documentId: number): Promise<void> {
    this.memoryVectors = this.memoryVectors.filter(
      (vec) => vec.metadata?.documentId !== documentId,
    );
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: (doc: MemoryVector) => boolean,
  ): Promise<[Document, number][]> {
    const results = this.memoryVectors
      .filter((vec) => {
        if (!filter) return true;
        return filter(vec);
      })
      .map((vec) => {
        return {
          doc: new Document({ pageContent: vec.content, metadata: vec.metadata }),
          score: this.cosineSimilarity(query, vec.embedding),
        };
      });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k).map((result) => [result.doc, result.score]);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
