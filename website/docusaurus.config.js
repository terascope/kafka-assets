module.exports = {
    title: 'Kafka Assets',
    tagline: 'Teraslice asset for kafka operations',
    url: 'https://terascope.github.io',
    baseUrl: '/kafka-assets/',
    organizationName: 'terascope',
    projectName: 'kafka-assets',
    scripts: [
        'https://buttons.github.io/buttons.js',
        'https://cdnjs.cloudflare.com/ajax/libs/clipboard.js/2.0.0/clipboard.min.js',
        '/kafka-assets/js/copy-code-block.js'
    ],
    stylesheets: [
        {
            href: '/kafka-assets/css/custom.css',
            type: 'text/css',
            rel: 'stylesheet'
        }
    ],
    favicon: 'img/favicon.png',
    customFields: {
        docsUrl: 'docs',
    },
    onBrokenLinks: 'log',
    onBrokenMarkdownLinks: 'log',
    presets: [
        [
            '@docusaurus/preset-classic',
            {
                docs: {
                    showLastUpdateAuthor: true,
                    showLastUpdateTime: true,
                    path: '../docs',
                    sidebarPath: './sidebars.json'
                },
                blog: {
                    path: 'blog'
                },
                theme: {
                    customCss: './src/css/customTheme.css'
                }
            }
        ]
    ],
    plugins: [],
    markdown: {
        mermaid: true,
        parseFrontMatter: async (params) => {
            // Wrap title value in double quotes if it has illegal character ':'
            if (params?.fileContent.startsWith('---\n' + 'title: ')) {
                const lines = params.fileContent.split('\n');
                const titleLine = lines[1];
                const lineParts = titleLine.split(':');
                if (lineParts.length > 2) { // there are 2 or more colons
                    let lineValue = titleLine.slice(7);
                    if (lineValue && lineValue.includes(':')) {
                        lineValue = `"${lineValue}"`;
                        lines[1] = `${lineParts[0]}: ${lineValue}`;
                        params.fileContent = lines.join('\n');
                    }
                }
            }
            const result = await params.defaultParseFrontMatter(params);
            return result;
        }

    },
    themes: ['@docusaurus/theme-mermaid'],
    themeConfig: {
        colorMode: {
            defaultMode: 'light',
            disableSwitch: false,
            respectPrefersColorScheme: true,
        },
        navbar: {
            title: 'Kafka Assets',
            logo: {
                src: 'img/logo.png'
            },
            items: [
                {
                    to: 'docs/asset/overview',
                    label: 'Asset',
                    position: 'left'
                },
                {
                    to: 'docs/packages/overview',
                    label: 'Packages',
                    position: 'left'
                },
                {
                    href: 'https://github.com/terascope/kafka-assets',
                    label: 'GitHub',
                    position: 'left'
                },
                {
                    href: 'https://terascope.github.io/teraslice',
                    label: 'Teraslice',
                    position: 'left'
                },
                {
                    to: '/help',
                    label: 'Help',
                    position: 'left'
                }
            ]
        },
        image: 'img/docusaurus.png',
        footer: {
            links: [
                {
                    title: 'Docs',
                    items: [
                        {
                            label: 'Overview',
                            to: '/',
                        },
                        {
                            label: 'Packages',
                            to: 'docs/packages/overview',
                        },
                        {
                            label: 'Asset',
                            to: 'docs/asset/overview',
                        },
                    ],
                },
                {
                    title: 'More',
                    items: [
                        {
                            label: 'Github',
                            to: 'https://github.com/terascope/kafka-assets',
                        },
                        {
                            to: 'https://terascope.github.io/teraslice/docs/asset-bundles',
                            label: 'More Teraslice Assets'
                        },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Terascope, LLC`,
            logo: {
                src: 'img/logo.png'
            }
        },
        algolia: {
            appId: 'KD1DQTOI4M',
            apiKey: '39a27eca4d31c921b2b412344351996e',
            indexName: 'terascope_teraslice_kafka-assets',
            contextualSearch: false
        },
        mermaid: {
            theme: {
                light: 'default',
                dark: 'dark'
            },
        }
    }
};
