"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Copy, Download, Edit3, Check, X, Save } from "lucide-react";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

// Simple JSON syntax highlighter component
function SyntaxHighlightedJSON({ code, highlightedLine }: { code: string, highlightedLine: number | null }) {
    const [highlightedElements, setHighlightedElements] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (highlightedLine !== null) {
            setHighlightedElements(new Set([highlightedLine]));
        } else {
            setHighlightedElements(new Set());
        }
    }, [highlightedLine]);

    const syntaxHighlight = (json: string) => {
        // Enhanced JSON syntax highlighting
        return json
            // Keys (strings that come before colons)
            .replace(/(".*?")(\s*:)/g, '<span class="text-green-600 dark:text-green-400">$1</span>$2')
            // Values that are strings
            .replace(/:\s*(".*?")/g, ': <span class="text-yellow-600 dark:text-yellow-400">$1</span>')
            // Numbers (including decimals)
            .replace(/:\s*(\b\d+\.?\d*\b)/g, ': <span class="text-orange-600 dark:text-orange-400">$1</span>')
            // Boolean and null literals
            .replace(/:\s*(\b(?:true|false|null)\b)/g, ': <span class="text-blue-600 dark:text-blue-400">$1</span>')
            // Hex values (addresses and hashes)
            .replace(/("0x[0-9a-fA-F]+")/g, '<span class="text-purple-600 dark:text-purple-400">$1</span>')
            // Structural elements
            .replace(/(\{|\}|\[|\])/g, '<span class="text-zinc-600 dark:text-zinc-300">$1</span>');
    };

    const lines = code.split('\n');
    const lineHeight = 20;

    return (
        <div className="relative font-mono text-[11px] leading-5">
            <pre className="whitespace-pre-wrap overflow-x-auto">
                {lines.map((line, index) => {
                    const lineNumber = index + 1;
                    const isHighlighted = highlightedElements.has(lineNumber);

                    return (
                        <div
                            key={lineNumber}
                            className={`relative ${isHighlighted ? 'bg-blue-200/30 dark:bg-blue-800/30' : ''}`}
                            style={{
                                paddingTop: '1px',
                                paddingBottom: '1px'
                            }}
                            data-line={lineNumber}
                        >
                            <span className="text-zinc-500 dark:text-zinc-400 pr-3 select-none inline-block w-8 text-right">
                                {lineNumber.toString().padStart(3, ' ')}
                            </span>
                            <span dangerouslySetInnerHTML={{ __html: syntaxHighlight(line) }} />
                        </div>
                    );
                })}
            </pre>
        </div>
    );
}

interface JsonPreviewPanelProps {
    jsonData: string;
    onJsonUpdate?: (newJson: string) => void;
    title?: string;
    highlightPath?: string;
    onHighlightChange?: (path: string | null) => void;
}

export function JsonPreviewPanel({
    jsonData,
    onJsonUpdate,
    title = "Genesis Configuration",
    highlightPath,
    onHighlightChange
}: JsonPreviewPanelProps) {
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedJson, setEditedJson] = useState(jsonData);
    const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
    const [jsonLines, setJsonLines] = useState<string[]>([]);
    const [jsonError, setJsonError] = useState<string | null>(null);

    useEffect(() => {
        setEditedJson(jsonData);
    }, [jsonData]);

    // Parse JSON and find line numbers for highlighting
    useEffect(() => {
        if (!jsonData || !jsonData.trim()) {
            setJsonLines([]);
            return;
        }

        try {
            const lines = jsonData.split('\n');
            setJsonLines(lines);

            // Define exact line numbers for key sections in the genesis JSON
            // Based on the structure from genGenesis.ts
            const pathMap: Record<string, { section: string, offset: number }> = {
                'chainId': { section: 'config', offset: 0 }, // Direct field in config: "chainId": 12345
                'tokenName': { section: '0x1111111111111111111111111111111111111111', offset: 0 }, // Coin name -> wrapped native token address
                'tokenSymbol': { section: 'alloc', offset: 0 }, // Token symbol affects allocations
                'tokenAllocations': { section: 'alloc', offset: 0 },

                // Fee configuration fields (all point to feeConfig section)
                'baseFeeChangeDenominator': { section: 'feeConfig', offset: 0 }, // Jump to feeConfig section
                'blockGasCostStep': { section: 'feeConfig', offset: 0 }, // Jump to feeConfig section
                'gasLimit': { section: 'feeConfig', offset: 0 }, // Jump to feeConfig section
                'maxBlockGasCost': { section: 'feeConfig', offset: 0 }, // Jump to feeConfig section
                'minBaseFee': { section: 'feeConfig', offset: 0 }, // Jump to feeConfig section
                'minBlockGasCost': { section: 'feeConfig', offset: 0 }, // Jump to feeConfig section
                'targetBlockRate': { section: 'feeConfig', offset: 0 }, // Jump to feeConfig section
                'targetGas': { section: 'feeConfig', offset: 0 }, // Jump to feeConfig section

                // Configuration fields (after feeConfig)
                'txAllowList': { section: 'config', offset: 9 }, // txAllowListConfig
                'contractDeployerAllowList': { section: 'config', offset: 10 }, // contractDeployerAllowListConfig
                'nativeMinterAllowList': { section: 'config', offset: 11 }, // contractNativeMinterConfig
                
                // Precompile configurations
                'precompile-contractDeployer': { section: 'contractDeployerAllowListConfig', offset: 0 },
                'precompile-nativeMinter': { section: 'contractNativeMinterConfig', offset: 0 },
                'precompile-txAllowList': { section: 'txAllowListConfig', offset: 0 },
                'precompile-feeManager': { section: 'feeManagerConfig', offset: 0 },
                'precompile-rewardManager': { section: 'rewardManagerConfig', offset: 0 },
                
                // Predeploy contracts
                'predeploy-proxy': { section: 'alloc', offset: 0 },
                'predeploy-proxyAdmin': { section: 'alloc', offset: 0 },
                'predeploy-icmMessenger': { section: 'alloc', offset: 0 },
                'predeploy-wrappedNativeToken': { section: 'alloc', offset: 0 },
                'predeploy-safeSingletonFactory': { section: 'alloc', offset: 0 },
                'predeploy-multicall3': { section: 'alloc', offset: 0 },
                'predeploy-create2Deployer': { section: 'alloc', offset: 0 },
            };

            // Find line number for the highlighted path
            if (highlightPath) {
                console.log('highlightPath received:', highlightPath);
                const lineNumber = findLineNumberForPath(lines, highlightPath, pathMap);
                console.log('lineNumber found:', lineNumber);
                setHighlightedLine(lineNumber);

                // Use setTimeout to ensure DOM has updated with syntax highlighting
                if (lineNumber) {
                    setTimeout(() => {
                        console.log('Calling scrollToLine after timeout');
                        scrollToLine(lineNumber);
                    }, 100);
                }
            } else {
                setHighlightedLine(null);
            }
        } catch (error) {
            console.error('Error parsing JSON for highlighting:', error);
            setJsonLines([]);
        }
    }, [jsonData, highlightPath]);

    const findLineNumberForPath = (lines: string[], path: string, pathMap: Record<string, { section: string, offset: number }>): number | null => {
        try {

            const config = pathMap[path];
            if (!config) {
                return null;
            }

            // Handle hex addresses (wrapped native token)
            if (config.section.startsWith('0x')) {
                // Remove 0x prefix and convert to lowercase for matching in alloc section
                const addressKey = config.section.slice(2).toLowerCase();
                
                for (let i = 0; i < lines.length; i++) {
                    // Check if the line contains the address (without quotes or with quotes)
                    if (lines[i].toLowerCase().includes(addressKey)) {
                        return i + 1; // Return the line with the address
                    }
                }
                // If not found in alloc, might not be enabled
                return null;
            }
            
            // Handle precompile config fields (they appear in the config section)
            if (config.section.includes('Config')) {
                // Search for the specific config field name
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(`"${config.section}"`)) {
                        return i + 1; // Return the line with the config field
                    }
                }
                return null;
            }

            // Find the line containing the target section
            let targetLine = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(`"${config.section}"`)) {
                    targetLine = i;
                    break;
                }
            }

            if (targetLine === -1) return null;

            // For nested structures, find the specific field
            if (config.section === 'config') {
                // For chainId specifically, search for it within the config section
                if (path === 'chainId') {
                    for (let i = targetLine; i < lines.length && i < targetLine + 50; i++) {
                        if (lines[i].includes('"chainId"')) {
                            return i + 1;
                        }
                    }
                }
                // For other config fields
                return targetLine + config.offset + 1;
            } else if (config.section === 'feeConfig') {
                // Find the feeConfig section
                let feeConfigLine = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('"feeConfig"')) {
                        feeConfigLine = i;
                        break;
                    }
                }
                if (feeConfigLine !== -1) {
                    return feeConfigLine + 1;
                }
                return targetLine + 1;
            } else if (config.section === 'alloc') {
                // For allocations and predeploys
                if (path.startsWith('predeploy-')) {
                    // Look for specific predeploy contract addresses (without 0x prefix in JSON)
                    const predeployAddresses: Record<string, string> = {
                        'predeploy-proxy': 'facade0000000000000000000000000000000000', // PROXY_ADDRESS
                        'predeploy-proxyAdmin': 'dad0000000000000000000000000000000000000', // PROXY_ADMIN_ADDRESS
                        'predeploy-wrappedNativeToken': '1111111111111111111111111111111111111111', // WRAPPED_NATIVE_TOKEN_ADDRESS
                        'predeploy-multicall3': 'ca11bde05977b3631167028862be2a173976ca11', // MULTICALL3_ADDRESS
                        'predeploy-create2Deployer': '13b0d85ccb8bf860b6b79af3029fca081ae9bef2', // CREATE2_DEPLOYER_ADDRESS
                        'predeploy-icmMessenger': '253b2784c75e510dd0ff1da844684a1ac0aa5fcf', // ICM_MESSENGER_ADDRESS
                        'predeploy-safeSingletonFactory': '914d7fec6aac8cd542e72bca78b30650d45643d7' // SAFE_SINGLETON_FACTORY_ADDRESS
                    };
                    
                    const searchKey = predeployAddresses[path];
                    if (searchKey) {
                        for (let i = targetLine; i < lines.length; i++) {
                            if (lines[i].toLowerCase().includes(searchKey.toLowerCase())) {
                                return i + 1;
                            }
                        }
                    }
                } else if (config.offset === 0) {
                    // Default: find first allocation entry
                    let allocStartLine = -1;
                    for (let i = targetLine; i < lines.length; i++) {
                        if (lines[i].match(/"[0-9a-fA-F]{40}"/)) { // Look for hex address
                            allocStartLine = i;
                            break;
                        }
                    }
                    if (allocStartLine !== -1) {
                        return allocStartLine + 1;
                    }
                }
            }

            return targetLine + 1;
        } catch (error) {
            console.error('Error finding line number:', error);
            return null;
        }
    };

    const scrollToLine = (lineNumber: number | null) => {
        if (lineNumber === null) {
            return;
        }

        console.log('scrollToLine called with lineNumber:', lineNumber);
        // More precise scrolling based on actual line content
        const element = document.querySelector('.json-preview-scroll');
        console.log('Found element:', element);
        if (element) {
            // Try multiple approaches to find and scroll to the target line

            // Approach 1: Look for data-line attribute
            const targetElement = element.querySelector(`[data-line="${lineNumber}"]`);
            console.log('Found target element with data-line:', targetElement);
            if (targetElement) {
                console.log('Scrolling to target element via data-line approach');
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
                return;
            }

            // Approach 2: Calculate based on line height
            console.log('Using approach 2: calculate based on line height');
            const lineHeight = 20; // Approximate line height in pixels
            const scrollTop = (lineNumber - 1) * lineHeight;
            element.scrollTop = Math.max(0, scrollTop - 150); // Scroll with some padding

            // Approach 3: If we have syntax highlighted content, try to find by nth-child
            const syntaxHighlightedElement = element.querySelector('pre');
            console.log('Found pre element:', syntaxHighlightedElement);
            if (syntaxHighlightedElement) {
                const childElements = syntaxHighlightedElement.querySelectorAll('div');
                console.log('Found child divs:', childElements.length);
                if (childElements.length >= lineNumber) {
                    const targetChild = childElements[lineNumber - 1];
                    console.log('Found target child:', targetChild);
                    if (targetChild) {
                        console.log('Scrolling to target via nth-child approach');
                        targetChild.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'nearest'
                        });
                    }
                }
            }
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(jsonData);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleDownload = () => {
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'genesis.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleEdit = () => {
        setIsEditing(true);
        setEditedJson(jsonData);
        setJsonError(null);
    };

    const handleSave = () => {
        try {
            // Validate JSON
            JSON.parse(editedJson);
            if (onJsonUpdate) {
                onJsonUpdate(editedJson);
            }
            setIsEditing(false);
            setJsonError(null);
        } catch (error) {
            setJsonError(`Invalid JSON: ${(error as Error).message}`);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditedJson(jsonData);
        setJsonError(null);
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const jsonSize = new Blob([jsonData]).size;
    const isValidJson = jsonData && jsonData !== "" && !jsonData.startsWith("Error:");
    const jsonSizeKiB = jsonSize / 1024;
    const maxSizeKiB = 64;
    const percent = Math.min((jsonSizeKiB / maxSizeKiB) * 100, 100);
    const statusText = !isValidJson
        ? 'Awaiting configuration'
        : percent >= 90
            ? 'Approaching P-Chain limit'
            : percent >= 75
                ? 'Consider optimizing'
                : 'Within safe limits';
    const barClass = percent >= 90 ? 'bg-red-500' : percent >= 75 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="h-full flex flex-col border-l border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {isValidJson ? `${jsonSizeKiB.toFixed(2)} KiB / ${maxSizeKiB} KiB • ${statusText}` : 'Awaiting configuration'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancel}
                                className="h-8"
                            >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleSave}
                                className="h-8"
                            >
                                <Save className="h-4 w-4 mr-1" />
                                Save
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleEdit}
                                disabled={!isValidJson}
                                className="h-8"
                            >
                                <Edit3 className="h-4 w-4 mr-1" />
                                Edit
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                                disabled={!isValidJson}
                                className="h-8"
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4 mr-1 text-green-500" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4 mr-1" />
                                        Copy
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownload}
                                disabled={!isValidJson}
                                className="h-8"
                            >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                            </Button>
                        </>
                    )}
                    </div>
                </div>
                {isValidJson && (
                    <div className="mt-2">
                        <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
                            <div className={`h-1.5 rounded-full transition-all duration-300 ${barClass}`} style={{ width: `${percent}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {/* JSON Content */}
            <div className="flex-1 overflow-auto p-3 bg-zinc-50 dark:bg-zinc-950 text-xs json-preview-scroll">
                {isEditing ? (
                    <div className="h-full">
                        {jsonError && (
                            <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
                                {jsonError}
                            </div>
                        )}
                        <textarea
                            value={editedJson}
                            onChange={(e) => {
                                setEditedJson(e.target.value);
                                setJsonError(null);
                            }}
                            className="w-full h-full p-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono text-xs rounded border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-blue-500 resize-none"
                            spellCheck={false}
                        />
                    </div>
                ) : (
                    <div className="rounded-lg overflow-hidden">
                        {isValidJson ? (
                            <div className="text-[11px] leading-5">
                                {jsonLines.length > 0 && highlightedLine ? (
                                    <div className="relative">
                                        <SyntaxHighlightedJSON
                                            code={jsonData}
                                            highlightedLine={highlightedLine}
                                        />
                                    </div>
                                ) : (
                                    <SyntaxHighlightedJSON
                                        code={jsonData}
                                        highlightedLine={null}
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
                                <div className="text-center">
                                    <p className="text-sm">Configure your chain to see the genesis JSON</p>
                                    {jsonData.startsWith("Error:") && (
                                        <p className="text-xs mt-2 text-red-400">{jsonData}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
