import type { Plugin } from 'vite';

type Token = { type: 'WORD'; value: string } | { type: '(' } | { type: ')' } | { type: 'SPACE' };

type WordNode = {
    type: 'Word';
    value: string;
};

type GroupNode = {
    type: 'Group';
    prefix: string;
    children: ASTNode[];
};

type ASTNode = WordNode | GroupNode;

// --- Tokenizer ---
function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let buffer = '';
    let inBracket = false;
    let bracketDepth = 0;

    const flush = () => {
        if (buffer.trim()) {
            tokens.push({ type: 'WORD', value: buffer.trim() });
            buffer = '';
        }
    };

    for (const char of input) {
        if (char === '[' && !inBracket) {
            inBracket = true;
            bracketDepth = 1;
            buffer += char;
        } else if (char === '[' && inBracket) {
            bracketDepth++;
            buffer += char;
        } else if (char === ']' && inBracket) {
            bracketDepth--;
            buffer += char;
            if (bracketDepth === 0) inBracket = false;
        } else if (!inBracket && (char === '(' || char === ')')) {
            flush();
            tokens.push({ type: char as '(' | ')' });
        } else if (!inBracket && /\s/.test(char)) {
            flush();
            tokens.push({ type: 'SPACE' });
        } else {
            buffer += char;
        }
    }

    flush();
    return tokens;
}

// --- Parser ---
function parse(tokens: Token[]): GroupNode {
    const root: GroupNode = { type: 'Group', prefix: '', children: [] };
    const stack: GroupNode[] = [root];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const current = stack[stack.length - 1];

        switch (token.type) {
            case 'WORD':
                // Check if next token is '(' → this word is a group prefix
                if (tokens[i + 1]?.type === '(') {
                    stack.push({ type: 'Group', prefix: token.value, children: [] });
                } else {
                    current.children.push({ type: 'Word', value: token.value });
                }
                break;

            case '(':
                // no action needed; the WORD before already pushed a new group
                break;

            case ')':
                const finished = stack.pop();
                if (!finished) throw new Error('Unbalanced parentheses in class string');
                stack[stack.length - 1].children.push(finished);
                break;

            case 'SPACE':
                // ignore spaces; tokens are already separated
                break;
        }
    }

    if (stack.length > 1) throw new Error('Unbalanced parentheses in class string');

    return root;
}

// --- Codegen (flatten) ---
function flatten(node: ASTNode, parentPrefix = ''): string[] {
    if (node.type === 'Word') {
        return [parentPrefix + node.value];
    }
    if (node.type === 'Group') {
        const newPrefix = parentPrefix + node.prefix;
        return node.children.flatMap((child) => flatten(child, newPrefix));
    }
    return [];
}

// --- Public API ---
export function expandGroups(classString: string): string {
    const tokens = tokenize(classString);
    const ast = parse(tokens);
    return flatten(ast).join(' ');
}

// --- Vite Plugin ---
export default function tailwindGrouping(): Plugin {
    return {
        name: 'tailwind-grouped-variants',
        enforce: 'pre',
        transform(code, id) {
            if (!/\.(jsx|tsx|js|ts|vue|php|blade\.php)$/.test(id)) return;

            let transformed = code;

            // React className="..."
            const classRegex = /className\s*=\s*"(.*?)"/gs;
            transformed = transformed.replace(classRegex, (match, classContent) => {
                return classContent.includes('(') ? `className="${expandGroups(classContent)}"` : match;
            });

            // tw`...` template literals (if twin macro is used)
            const twRegex = /tw`([^`]+)`/gs;
            transformed = transformed.replace(twRegex, (match, classContent) => {
                return classContent.includes('(') ? `tw\`${expandGroups(classContent)}\`` : match;
            });

            // Blade, Vue, HTML, ... class="..."
            const plainClassRegex = /class\s*=\s*"(.*?)"/gs;
            transformed = transformed.replace(plainClassRegex, (match, classContent) => {
                return classContent.includes('(') ? `class="${expandGroups(classContent)}"` : match;
            });

            return { code: transformed, map: null };
        },
    };
}
