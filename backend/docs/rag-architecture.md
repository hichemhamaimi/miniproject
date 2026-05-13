# Study Material Processing and RAG Flow

## Processing pipeline

1. The teacher uploads a source file through `/teacher/materials/upload`.
2. `materialParser` extracts raw text, normalizes whitespace, and stores clean text in Mongo while processing continues.
3. The queue worker chunks the material, generates embeddings, stores vectors in the vector layer, and marks the material as ready.

## Chunking strategies

### Fixed-size chunking
- Uses a deterministic character window derived from token estimates.
- Good for predictable throughput and fallback behavior.
- Implemented in `splitFixedChunks`.

### Semantic chunking
- Splits on paragraph boundaries and groups nearby paragraphs.
- Better preserves topic coherence than rigid windows.
- Implemented in `splitSemanticChunks`.

### Overlapping chunks
- Adjacent chunks intentionally overlap.
- This prevents boundary loss when a concept starts at the end of one chunk and continues into the next.
- In the current implementation, semantic chunking overlaps one paragraph and fixed chunking overlaps `chunkOverlapTokens`.

## Why this strategy

The default is `semantic_overlap`. It keeps concepts together while still providing redundancy near boundaries. If the source text is badly structured, the code falls back cleanly to fixed-size chunks.

## Embeddings

- Each chunk is embedded through `embeddingService`.
- Providers can be Gemini or local transformers today, with the retrieval layer remaining provider-agnostic.
- Embeddings are stored in the vector store through `vectorService`.

## Retrieval

1. The user query is embedded.
2. The vector database returns a larger candidate window.
3. `retrievalService` re-ranks those candidates with a lexical overlap bonus.
4. Top-k chunks are cached briefly to reduce repeat work on frequent prompts.

## Prompt construction

- Retrieved chunks are injected into the prompt as grounded context.
- The implementation keeps context bounded because every provider has a context window and token budget.
- The services bias toward the most relevant chunks first instead of dumping the entire corpus.

## Advanced improvements included

- Re-ranking: vector similarity plus keyword overlap.
- Filtering noise: empty queries short-circuit and malformed chunks are ignored.
- Hybrid search: lexical re-ranking layered on top of vector similarity.
- Caching: short-lived in-memory query cache for repeated lookups.

## Future extensions

- Persist per-chunk metadata such as section titles and page numbers.
- Add a second-stage cross-encoder re-ranker.
- Capture per-material filters so retrieval can be scoped by module, exam, or teacher intent.
