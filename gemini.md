# Architectural Evolution Plan for UA COM Navigator

**Date:** 2026-02-05

## 1. Introduction

This document outlines five critical architectural and design updates for the UA COM Navigator project. These proposals are designed to address the growing complexity of the application, enhance maintainability, improve developer experience, and future-proof the system against upcoming requirements. Each proposal includes a detailed problem statement, a phased implementation plan, and an analysis of its benefits and risks.

---

## 2. Decompose the Backend into a Service-Oriented Architecture (SOA)

### 2.1. Problem Statement

The current backend is a monolithic Node.js/Express application acting as a "proxy and orchestrator." It is responsible for a wide range of tasks, including API proxying to UA servers, SVN integration logic, user authentication, serving the frontend, and all business logic. As new, complex features are planned (e.g., MIB Browser, LLM Assistant, advanced PCOM metrics), adding them to this monolith will exponentially increase its complexity, leading to tight coupling, deployment bottlenecks, and difficulties in scaling and maintenance.

### 2.2. Proposed Architecture

We will evolve the backend from a monolith to a more flexible Service-Oriented Architecture (SOA). The core Express application will be redefined as a **Backend-for-Frontend (BFF)**, and distinct business domains will be extracted into independent microservices.

**Key Components:**

1.  **BFF (Backend-for-Frontend):**
    *   **Responsibilities:** User authentication/session management, request routing to internal services, response aggregation, and serving the frontend application. It should contain minimal business logic.
    *   **Technology:** Continue using Node.js/Express.

2.  **COM Service:**
    *   **Responsibilities:** The core business logic for FCOM/PCOM files. This includes parsing, validating, editing, and managing the lifecycle of COM files. It will own the Domain Model (see Proposal #3) and interact with the Version Control Adapter (see Proposal #4).
    *   **Technology:** Node.js/TypeScript.

3.  **MIB Service:**
    *   **Responsibilities:** All functionality related to MIBs. This includes parsing uploaded MIB files (using `snmptranslate`), providing a browsable tree structure via an API, and generating FCOM/PCOM stubs.
    *   **Technology:** Node.js/TypeScript or a suitable language for processing MIBs.

4.  **LLM/AI Service:**
    *   **Responsibilities:** Encapsulate all interactions with external language models (OpenAI, OCI). This service will manage prompt engineering, context packing (including RAG from a vector store), and providing a simplified API for the BFF to consume (e.g., `POST /suggest-processor`).
    *   **Technology:** Python is a strong candidate here due to its rich ecosystem of AI/ML libraries (e.g., LangChain, spaCy), but Node.js is also viable.

**Service Communication:**

*   Services will communicate over a simple, synchronous protocol like **HTTP/REST**. The BFF will be responsible for orchestrating these calls. For example, when a user asks for an LLM suggestion, the BFF authenticates the user, calls the COM Service to get the current file context, then calls the LLM Service with that context.

### 2.3. Implementation Plan

**Phase 1: Initial Scaffolding and Service Discovery**
1.  Set up a monorepo structure (if not already present) that can accommodate multiple services.
2.  Implement a lightweight service discovery mechanism or use environment variables for inter-service communication.
3.  Containerize each service using Docker for consistent development and deployment environments.

**Phase 2: Extract the MIB Service**
1.  Migrate all existing MIB-related logic from the monolith to a new, dedicated MIB Service.
2.  Update the BFF to proxy all MIB-related API calls to this new service.
3.  Deploy the MIB service alongside the main application.

**Phase 3: Extract the COM Service**
1.  This is the most significant step. Systematically move the domain logic for COM files (parsing, validation) from the BFF into the new COM Service.
2.  Implement the Version Control Adapter (Proposal #4) within this service.
3.  Refactor the BFF to delegate all COM file operations to the COM Service.

**Phase 4: Build the LLM/AI Service**
1.  Develop the new LLM Service from scratch, following the defined responsibilities.
2.  Integrate it with the BFF once the core API is stable.

### 2.4. Benefits

*   **Improved Maintainability:** Smaller, focused services are easier to understand, debug, and test.
*   **Independent Deployments:** Teams can develop, test, and deploy services independently, increasing development velocity.
*   **Technology Flexibility:** Each service can be built with the technology best suited for its purpose (e.g., Python for AI).
*   **Scalability:** Services can be scaled independently based on their specific load.

---

## 3. Introduce a Formal Domain Model in the Backend

### 3.1. Problem Statement

The backend currently treats COM files as opaque JSON blobs. It fetches them from the UA server and passes them to the frontend without any semantic understanding of their content. This forces the frontend to contain all of the complex business logic for interpreting, validating, and manipulating these files, making the client heavy, fragile, and difficult to test.

### 3.2. Proposed Architecture

We will implement a rich, object-oriented **Domain Model** within the **COM Service** (from Proposal #2). This model will represent the structure and behavior of FCOM/PCOM files as first-class citizens of the backend.

**Example Domain Object (`Processor`):**

```typescript
// Before: A generic JSON object
const processor = { type: 'set', field: 'Node', value: 'my-node' };

// After: A class with encapsulated logic and validation
interface ProcessorConfig {
  type: 'set' | 'regex' | 'math';
  field: string;
  // ... other properties
}

class Processor {
  public readonly type: ProcessorType;
  public field: string;
  // ...

  constructor(config: ProcessorConfig) {
    // ... constructor logic
  }

  /**
   * Validates that the processor has all required fields for its type.
   * @returns {boolean} True if valid.
   * @throws {ValidationError} If invalid.
   */
  public validate(): boolean {
    if (this.type === 'set' && !this.value) {
      throw new ValidationError("'set' processor requires a 'value' property.");
    }
    // ... more validation logic
    return true;
  }

  /**
   * Converts the processor object back to its plain JSON representation for storage.
   */
  public toJSON(): object {
    // ... serialization logic
  }
}
```

The backend API will then operate on this model. Instead of a generic `POST /files/{id}` endpoint that accepts a massive JSON file, the API could become more granular and expressive:

*   `GET /files/{id}/objects`: Get all event objects in a file.
*   `POST /files/{id}/objects/{objectId}/processors`: Add a new processor to an event object.
*   `GET /files/{id}/validate`: Trigger a full validation of the file on the backend.

### 3.3. Implementation Plan

**Phase 1: Define Core Interfaces**
1.  In the COM Service, create TypeScript interfaces for the main entities: `FcomFile`, `PcomFile`, `EventObject`, `Processor`, `AdvancedFlow`.
2.  These interfaces will initially just define the data structure.

**Phase 2: Implement Domain Classes**
1.  Create classes that implement these interfaces.
2.  Add `fromJSON()` static methods to parse raw JSON into class instances and `toJSON()` methods to serialize them back.
3.  Start migrating business logic into these classes. A good starting point is validation logic.

**Phase 3: Refactor Services and API Endpoints**
1.  Refactor the COM Service to use the new domain model internally.
2.  Begin exposing more granular API endpoints that operate on the domain model.
3.  Gradually update the frontend to use these new, more powerful endpoints, which will allow for the removal of corresponding logic from the client.

### 3.4. Benefits

*   **Single Source of Truth:** Business logic is centralized in the backend, eliminating inconsistencies.
*   **Improved Testability:** Domain objects can be unit-tested in isolation, without needing a running frontend or a live database.
*   **Thinner Client:** The frontend becomes simpler, focusing on presentation and user interaction rather than complex business rule implementation.
*   **Richer API:** The API becomes more expressive and easier for consumers (including potentially third-party tools) to use.

---

## 4. Implement a Dedicated Frontend Server-State Management Library

### 4.1. Problem Statement

The frontend relies on Zustand for state management. While excellent for client-side state (e.g., UI toggles), it lacks built-in mechanisms for managing server state. This leads to developers writing complex, manual, and often buggy boilerplate using `useEffect` and `useState` to handle data fetching, caching, loading/error states, and optimistic updates. This slows down development and leads to a less responsive UI.

### 4.2. Proposed Architecture

We will adopt **TanStack Query (formerly React Query)** as the standard for managing all server state in the frontend. It will live alongside Zustand, with each tool handling its designated responsibility.

*   **Zustand:** Continues to manage purely client-side state (e.g., which panels are open, the content of un-submitted forms, current theme).
*   **TanStack Query:** Manages the entire lifecycle of data fetched from the server. This includes caching, background re-fetching, request deduplication, and mutation handling.

**Example: Before (Manual Fetching)**

```tsx
const [file, setFile] = useState(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  setIsLoading(true);
  api.get(`/files/${fileId}`)
    .then(res => setFile(res.data))
    .catch(err => setError(err))
    .finally(() => setIsLoading(false));
}, [fileId]);
```

**Example: After (with TanStack Query)**

```tsx
import { useQuery } from '@tanstack/react-query';

const { data: file, isLoading, isError, error } of useQuery({
  queryKey: ['file', fileId],
  queryFn: () => api.get(`/files/${fileId}`).then(res => res.data),
});
```

### 4.3. Implementation Plan

**Phase 1: Setup and Configuration**
1.  Add `@tanstack/react-query` to the frontend `package.json`.
2.  Wrap the root `App` component with the `<QueryClientProvider>`.
3.  Configure a global `QueryClient` with project-specific defaults (e.g., cache stale time, retry policies).

**Phase 2: Incremental Adoption**
1.  Identify a non-critical part of the application that fetches data (e.g., the folder browser).
2.  Refactor this feature to use `useQuery` instead of manual `useEffect` hooks.
3.  Establish patterns for query key management to ensure consistent caching.

**Phase 3: Full Rollout and Mutation Handling**
1.  Systematically refactor all data-fetching logic across the application to use `useQuery`.
2.  Implement `useMutation` for all create, update, and delete operations.
3.  Leverage `useMutation`'s `onSuccess` and `onError` callbacks to handle cache invalidation and optimistic updates, providing a seamless user experience.

### 4.4. Benefits

*   **Drastically Reduced Boilerplate:** Simplifies data fetching logic by up to 90%.
*   **Improved Performance:** The intelligent caching and request deduplication make the app feel faster and reduce load on the backend.
*   **Better User Experience:** Automatic background refetching ensures data is always fresh, and optimistic updates make mutations feel instantaneous.
*   **Built-in DevTools:** Provides excellent developer tools for inspecting the cache and debugging queries.

---

## 5. Abstract the Version Control System with an Adapter

### 5.1. Problem Statement

The application's logic is fundamentally intertwined with the fact that its file storage is an SVN repository accessed via a specific UA REST API. This tight coupling poses a significant architectural risk. The system is not adaptable to other storage backends (like Git, or even a local filesystem for development/testing), and it makes unit testing the business logic nearly impossible without a live UA server.

### 5.2. Proposed Architecture

We will apply the **Adapter Pattern** and **Dependency Inversion Principle** to decouple the core application logic from the underlying version control system (VCS).

1.  **Define an Interface:** Create a generic `IVersionedStorage` TypeScript interface in the COM Service. This interface will define a contract for all interactions with a VCS.

    ```typescript
    interface CommitOptions {
      message: string;
      author: { name: string; email: string; };
    }

    interface IVersionedStorage {
      getFile(filePath: string, revision?: string): Promise<string>;
      listFiles(dirPath: string): Promise<string[]>;
      commitFile(filePath: string, content: string, options: CommitOptions): Promise<string>; // Returns commit ID
      getHistory(filePath: string, limit: number): Promise<CommitHistory[]>;
      diffFiles(filePath: string, rev1: string, rev2: string): Promise<string>;
    }
    ```

2.  **Implement a Concrete Adapter:** The existing code that calls the UA REST API will be moved into a dedicated `SvnRestApiAdapter` class that implements the `IVersionedStorage` interface.

3.  **Use Dependency Injection:** The COM Service's business logic will not instantiate the adapter directly. Instead, it will be "given" an instance of `IVersionedStorage` via its constructor. This allows the implementation to be swapped out easily.

### 5.3. Implementation Plan

**Phase 1: Define the Interface and Refactor**
1.  Define and agree upon the final `IVersionedStorage` interface.
2.  Create the `SvnRestApiAdapter` class and move all existing REST API call logic into it.
3.  Refactor the COM Service to depend on the interface, not the concrete class.

**Phase 2: Implement a Mock Adapter for Testing**
1.  Create a `MockStorageAdapter` that implements the `IVersionedStorage` interface and operates on an in-memory map or a temporary filesystem.
2.  This adapter will be crucial for unit-testing the COM Service's business logic without any external dependencies.

**Phase 3: Future Adapters (as needed)**
1.  If the need arises, new adapters like `GitAdapter` or `FileSystemAdapter` can be created by simply implementing the same interface.

### 5.4. Benefits

*   **Flexibility:** The application can be adapted to support new storage backends (Git, different cloud providers) with minimal changes to the core business logic.
*   **Enhanced Testability:** The `MockStorageAdapter` allows for fast, reliable, and isolated unit tests of the entire service layer.
*   **Clear Separation of Concerns:** The business logic is cleanly separated from the data access/infrastructure logic.

---

## 6. Formalize a "Test Harness" for Reliable End-to-End Testing

### 6.1. Problem Statement

While the project plans mention testing, there is no architectural provision for enabling reliable, automated end-to-end (E2E) tests. Running E2E tests against a live, multi-tenant UA server is slow, brittle, prone to data contention, and makes CI/CD integration a nightmare.

### 6.2. Proposed Architecture

We will create a first-class **"Test Harness"** mode for the entire application stack. This mode will be designed specifically for running automated E2E tests in a controlled, isolated, and repeatable environment.

**Architectural Components:**

1.  **Test Mode Activation:** The entire stack (BFF, services, frontend) will be able to run in a "test" mode, activated by an environment variable (e.g., `APP_MODE=test`).

2.  **Mock Infrastructure:** When in test mode:
    *   The COM Service will be automatically configured to use the `MockStorageAdapter` (from Proposal #4) instead of the `SvnRestApiAdapter`.
    *   Any other external dependencies (LLM Service, external authentication providers) will be replaced with mock implementations that expose the same API but return predictable, controlled responses.

3.  **E2E Test Runner:**
    *   We will use a modern E2E test runner like **Cypress** or **Playwright**.
    *   Tests will be written to simulate real user workflows (e.g., `login.spec.ts`, `edit-and-save-file.spec.ts`).
    *   Before each test run, the test runner will communicate with a dedicated backend endpoint (e.g., `POST /_test/seed-data`) to seed the `MockStorageAdapter` with the specific files and state needed for that test. After the test, another endpoint (`POST /_test/reset`) will clear the state.

### 6.3. Implementation Plan

**Phase 1: Framework Setup**
1.  Choose an E2E framework (Cypress is a strong choice for its developer experience) and add it to the repository.
2.  Implement the `APP_MODE=test` environment variable flag in the application's startup scripts.
3.  Implement the `MockStorageAdapter` as the first piece of mock infrastructure.

**Phase 2: Build the Test Harness API**
1.  In the BFF, create a set of test-only API endpoints (e.g., under a `/_test` prefix) that are only enabled when `APP_MODE=test`.
2.  These endpoints will allow the test runner to programmatically control the state of the mock backend (e.g., seeding data, resetting state, simulating errors).

**Phase 3: Write and Integrate Tests**
1.  Write E2E tests for the most critical user flows.
2.  Integrate the E2E test suite into the CI/CD pipeline. The pipeline script will:
    *   Build the application.
    *   Start the entire stack with `APP_MODE=test`.
    *   Run the E2E test suite against the local, mocked application.
    *   Fail the build if any E2E tests fail.

### 6.4. Benefits

*   **Reliability:** E2E tests become deterministic, fast, and reliable, free from network flakiness or external server issues.
*   **CI/CD Integration:** Enables a true "shift-left" approach where full-stack integration tests are run on every commit.
*   **Confidence:** Provides high confidence that core user workflows are always functional, dramatically reducing the risk of regressions.
*   **Developer Experience:** Developers can run the entire E2E suite on their local machines with a single command, speeding up the development and debugging cycle.
