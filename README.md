# Invoice GraphRAG 

Turns invoice JSON into an RDF/Turtle knowledge graph in GraphDB, then lets you query it in natural language (SPARQL generation + retrieval-augmented chat) through the Model Context Protocol (MCP).

## Projects

| Project | Role |
|---|---|
| `MCPClient` | ASP.NET Core web host + MCP client. Serves the browser UI and exposes REST endpoints that call MCP tools. |
| `MCPServer` | MCP server host (MCPSharp). Exposes `GraphTools` methods as MCP tools over stdio. |
| `GraphTools` | Class library with the tool implementations: JSON to Turtle conversion, GraphDB repository management, SPARQL execution, chat-based retrieval. |

## How client and server connect

```
Browser (wwwroot)
      |  fetch()
      v
MCPClient  --  http://localhost:5004
      |  spawns MCPServer.exe as a subprocess
      |  talks MCP (JSON-RPC over stdio)
      v
MCPServer  (no HTTP port, hosts the tool catalog)
      |  dispatches to GraphTools methods
      v
GraphTools  --  HTTP  -->  GraphDB (localhost:7200) + chat/assistant API
```

`MCPClient` never calls `GraphTools` directly. On startup it creates an MCP client pointing at the compiled server:

```csharp
mcpClient = new MCPClient(
    name: "McpClient",
    version: "v1.0.0",
    server: @"...\MCPServer\bin\Debug\net8.0\McpServer.exe");
```

This launches `MCPServer.exe` as a child process and exchanges JSON-RPC messages over stdio, the same mechanism MCP-compatible editors/agents use. `MCPServer` has a project reference to `GraphTools` and exposes every `[McpServerTool]` method there (`get_repositories`, `convert_json_to_turtle`, `create_graph_db_repository`, `upload_turtle_to_repository`, `execute_sparql`, `execute_plugin_retrieval`, `execute_sparql_retrieval`, ...) as a callable tool.

`MCPClient`'s REST endpoints are thin wrappers around `mcpClient.CallToolAsync(toolName, parameters)`:

| Endpoint | Purpose |
|---|---|
| `POST /api/upload` | Convert uploaded JSON to Turtle, create GraphDB repo, upload data. |
| `POST /api/query` | Run a query using one of the retrieval methods below. |
| `POST /api/repositories` | List available GraphDB repositories. |
| `GET /api/tools` | List MCP tools exposed by the server. |

## Query flow (`/api/query`)

1. Browser posts `{ query, repository, retrievalMethod }`.
2. `MCPClient` picks a tool based on `retrievalMethod`:
   - `execute_sparql` (default) - if the query isn't valid SPARQL, it's translated first via an LLM prompt, then run against GraphDB.
   - `plugin_retrieval` - uses the GraphDB chat assistant.
   - `sparql_retrieval` - uses a chat assistant specialized in SPARQL.
3. The tool call goes over MCP (stdio) to `MCPServer` -> `GraphTools` -> GraphDB/chat API.
4. The text result flows back: GraphTools -> MCPServer -> MCPClient -> browser (JSON).

## Running locally

1. Build `MCPServer` (Debug, `net8.0`) so `MCPClient` can find `MCPServer.exe` at the path in `Program.cs`. Update the path if your build output differs.
2. Start GraphDB on `http://localhost:7200`.
3. Run `MCPClient` (`dotnet run` in `invoice/MCPClient`):
   - starts on `http://localhost:5004`,
   - launches `MCPServer.exe`,
   - opens your browser automatically.
4. Upload invoice JSON and run natural-language / SPARQL queries from the UI.


