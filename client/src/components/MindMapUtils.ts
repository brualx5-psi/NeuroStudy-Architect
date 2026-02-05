
import { Node, Edge, Position } from 'reactflow';
import dagre from 'dagre';

// Cores vibrantes "banana do gemini" style
const COLORS = [
    { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' }, // Azul (Central)
    { bg: '#10b981', border: '#059669', text: '#ffffff' }, // Verde
    { bg: '#f59e0b', border: '#d97706', text: '#ffffff' }, // Laranja
    { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' }, // Roxo
    { bg: '#ef4444', border: '#dc2626', text: '#ffffff' }, // Vermelho
    { bg: '#ec4899', border: '#db2777', text: '#ffffff' }, // Rosa
    { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' }, // Ciano
];

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

// Extrai nós e conexões de uma string Mermaid simples
// Suporta: A[Label] --> B[Label]
//          A --> B
export const parseMermaidToFlow = (mermaidCode: string): { nodes: Node[], edges: Edge[] } => {
    const nodes: Record<string, Node> = {};
    const edges: Edge[] = [];
    const lines = mermaidCode.split('\n');

    // Regex para capturar padrões: ID[Label] ou ID
    // Ex: "A[Inteligência Artificial]"
    const nodeRegex = /([a-zA-Z0-9_]+)\s*(?:\[(.+?)\]|\((.+?)\))?/;

    // Regex para conexões: A --> B
    // const connectionRegex = /([a-zA-Z0-9_]+)\s*-+>\s*([a-zA-Z0-9_]+)/; // Simples
    // Mais robusto para capturar labels juntos com conexoes na mesma linha

    let colorIndex = 1; // 0 é central
    const rootId = 'root'; // Tentativa de identificar root

    lines.forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('graph') || line.startsWith('%%')) return;

        if (line.includes('-->') || line.includes('---')) {
            const parts = line.split(/[-=]+>/); // Split por setas
            if (parts.length >= 2) {
                let sourceRaw = parts[0].trim();
                let targetRaw = parts[1].trim();

                // Handle Mermaid labeled arrows: A -->|label| B
                sourceRaw = sourceRaw.replace(/\|[^|]*\|\s*$/g, '').trim();
                targetRaw = targetRaw.replace(/^\|[^|]*\|\s*/g, '').trim();

                const sourceMatch = sourceRaw.match(nodeRegex);
                const targetMatch = targetRaw.match(nodeRegex);

                if (sourceMatch && targetMatch) {
                    const sourceId = sourceMatch[1];
                    const sourceLabel = (sourceMatch[2] || sourceMatch[3] || sourceId).replace(/["']/g, '');

                    const targetId = targetMatch[1];
                    const targetLabel = (targetMatch[2] || targetMatch[3] || targetId).replace(/["']/g, '');

                    // Helper cria nó
                    const addNode = (id: string, label: string) => {
                        if (!nodes[id]) {
                            // Tenta detectar se é nó raiz (geralmente o primeiro ou tem muitas conexões de saída)
                            // Logica simplificada: Ordem de aparecimento
                            const isRoot = Object.keys(nodes).length === 0;

                            // Determina cor
                            let styleIdx = isRoot ? 0 : colorIndex % (COLORS.length - 1) + 1;
                            if (isRoot) {/* Mantem 0 */ }
                            else {
                                // Se este nó é filho direto do root, ganha nova cor. Se é neto, herda?
                                // Simplificação: Random colors para filhos
                                colorIndex++;
                            }

                            nodes[id] = {
                                id,
                                type: 'mindMap', // Nosso tipo custom
                                data: { label, level: isRoot ? 0 : 1 },
                                position: { x: 0, y: 0 }, // Será calculado pelo Dagre
                            };
                        } else {
                            // Atualiza label se achou uma melhor agora
                            if (label !== id && nodes[id].data.label === id) {
                                nodes[id].data.label = label;
                            }
                        }
                    };

                    addNode(sourceId, sourceLabel);
                    addNode(targetId, targetLabel);

                    edges.push({
                        id: `e${sourceId}-${targetId}`,
                        source: sourceId,
                        target: targetId,
                        type: 'default', // Bezier curvo (orgânico)
                        animated: true,
                        style: { stroke: '#94a3b8', strokeWidth: 3 },
                    });
                }
            }
        }
    });

    return { nodes: Object.values(nodes), edges };
};

export const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({ rankdir: 'LR' }); // Left to Right layout (Mind Map style)

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);

        // Assign colors based on clusters/branches logic roughly
        // Se o nó for root (level 0), cor azul.
        // Filhos diretos do root ganham cores diferentes.
        // Netos herdam cor do pai. (Complexo sem percorrer árvore).
        // Vou usar cores simples cíclicas na criação por enquanto.

        // Ajuste fino para centralizar
        node.targetPosition = Position.Left;
        node.sourcePosition = Position.Right;

        // We are shifting the dagre node position (anchor=center center) to the top left
        // so it matches the React Flow node anchor point (top left).
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - NODE_WIDTH / 2,
                y: nodeWithPosition.y - NODE_HEIGHT / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};
