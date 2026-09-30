import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentChunk } from '../document/entities/document-chunk.entity';
import { Document } from '../document/entities/document.entity';
import { DocumentStatus } from '../document/enums/document-status.enum';

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  private embeddings: OpenAIEmbeddings;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(DocumentChunk)
    private readonly documentChunkRepository: Repository<DocumentChunk>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {
    const openAIApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';

    this.embeddings = new OpenAIEmbeddings({
      apiKey: openAIApiKey,
      model: 'text-embedding-3-small',
    });
  }

  /**
   * Adds a document to the vector store by splitting its text and saving to PGVector.
   */
  async addDocuments(
    text: string,
    siteId: number,
    documentId: number,
    filename: string,
  ): Promise<void> {
    try {
      // First, delete any existing chunks for this document in Postgres
      await this.documentChunkRepository.delete({ documentId });

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const chunks = await splitter.splitText(text);

      const documents = chunks.map((chunk, index) => ({
        pageContent: chunk,
        metadata: { siteId, documentId, filename, chunkIndex: index },
      }));

      // Generate embeddings
      const textsToEmbed = documents.map((d) => d.pageContent);
      const embeddings = await this.embeddings.embedDocuments(textsToEmbed);

      // Save to PostgreSQL
      const dbChunks = chunks.map((chunk, index) => {
        return this.documentChunkRepository.create({
          documentId,
          siteId,
          chunkIndex: index,
          content: chunk,
          embedding: `[${embeddings[index].join(',')}]`,
        });
      });
      await this.documentChunkRepository.save(dbChunks);
      console.log('Documents:', documents);

      this.logger.log(
        `Successfully added ${chunks.length} chunks for doc ${documentId} (site ${siteId}) to vector store.`,
      );
    } catch (error) {
      this.logger.error(`Failed to add documents to vector store for doc ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a document from the vector store.
   * Postgres chunks are handled by cascade delete.
   */
  async deleteDocuments(documentId: number): Promise<void> {
    try {
      await this.documentChunkRepository.delete({ documentId });
      this.logger.log(`Successfully removed doc ${documentId} from Postgres vector store.`);
    } catch (error) {
      this.logger.error(`Failed to remove doc ${documentId} from vector store:`, error);
      throw error;
    }
  }

  /**
   * Performs a similarity search using PGVector.
   */
  async similaritySearch(
    query: string,
    siteId: number,
    k: number = 3,
  ): Promise<{ content: string; documentId: number; filename: string; similarity: number }[]> {
    try {
      const MIN_SIMILARITY_SCORE = 0.5;
      const queryEmbedding = await this.embeddings.embedQuery(query);
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      const detailedPgResults = await this.documentChunkRepository
        .createQueryBuilder('chunk')
        .innerJoin('chunk.document', 'document')
        .select([
          'chunk.content',
          'chunk.documentId',
          'document.filename',
          `1 - (chunk.embedding <=> '${embeddingString}') AS similarity`,
        ])
        .where('chunk.siteId = :siteId', { siteId })
        .andWhere('document.status = :status', { status: DocumentStatus.READY })
        .orderBy(`chunk.embedding <=> '${embeddingString}'`, 'ASC')
        .limit(k)
        .getRawMany();

      const finalResults: {
        content: string;
        documentId: number;
        filename: string;
        similarity: number;
      }[] = [];

      for (const row of detailedPgResults) {
        if (row.similarity >= MIN_SIMILARITY_SCORE) {
          finalResults.push({
            content: row.chunk_content,
            documentId: row.chunk_documentId,
            filename: row.document_filename,
            similarity: row.similarity,
          });
        }
      }

      return finalResults;
    } catch (error) {
      this.logger.error(`Failed to search vector store for site ${siteId}:`, error);
      return [];
    }
  }
}
