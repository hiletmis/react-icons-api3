const chains = require('@api3/chains');
const fs = require('fs/promises');
const rimraf = require('rimraf');
const svgr = require('@svgr/core').default;
const camelcase = require('camelcase');
const babel = require('@babel/core');

const outputPath = './dist';

async function transformSVGtoJSX(file, componentName, format, dir) {
    const content = await fs.readFile(`${dir}/${file}`, 'utf-8');
    const svgReactContent = await svgr(
        content,
        {
            icon: false,
            replaceAttrValues: { '#00497A': "{props.color || '#00497A'}" },
            svgProps: {
                width: 32,
                height: 32,
            },
        },
        { componentName }
    );

    let { code } = await babel.transformAsync(svgReactContent, {
        presets: [['@babel/preset-react', { useBuiltIns: true }]],
    });


    if (format === 'esm') {
        return code;
    }

    const replaceESM = code
        .replace(
            'import * as React from "react";',
            'const React = require("react");'
        )
        .replace('export default', 'module.exports =');
    return replaceESM;
}

function indexFileContent(files, format, includeExtension = true) {
    let content = '';
    const extension = includeExtension ? '.js' : '';
    files.map((fileName) => {
        const componentName = `${camelcase(fileName.replace(/.svg/, ''), {
            pascalCase: true,
        })}Icon`;
        const directoryString = `'./${componentName}${extension}'`;
        content +=
            format === 'esm'
                ? `export { default as ${componentName} } from ${directoryString};\n`
                : `module.exports.${componentName} = require(${directoryString});\n`;
    });

    content += format === 'esm' ? `export { default as ChainIcon } from './ChainIcon';\n` : `module.exports.ChainIcon = require('./ChainIcon.js');\n`;

    return content;
}

async function buildIcons(format = 'esm', dir) {
    let outDir = `${outputPath}/${format}`;

    await fs.mkdir(outDir, { recursive: true });

    const files = await fs.readdir(dir, 'utf-8');

    chains.CHAINS.forEach(async (chain) => {
        const file = files.find(file => file.includes(`Chain${chain.id}`))
        let fileName = file;

        if (!fileName) {
            return
        }

        const componentName = `${camelcase(fileName.replace(/.svg/, ''), {
            pascalCase: true,
        })}Icon`;
        const content = await transformSVGtoJSX(fileName, componentName, format, dir);
        const types = `import * as React from 'react';\ndeclare function ${componentName}(props: React.SVGProps<SVGSVGElement>): JSX.Element;\nexport default ${componentName};\n`;

        // console.log(`- Creating file: ${componentName}.js`);
        await fs.writeFile(`${outDir}/${componentName}.js`, content, 'utf-8');
        await fs.writeFile(`${outDir}/${componentName}.d.ts`, types, 'utf-8');

    })

    const types = `import * as React from 'react';\ndeclare function ChainIcon(props: React.SVGProps<SVGSVGElement>): JSX.Element;\nexport default ChainIcon;\n`;
    await fs.writeFile(
        `${outDir}/ChainIcon.d.ts`,
        types,
        'utf-8'
    )
    let { code } = await babel.transformAsync(`
        import * as React from "react";
        import Chain43113Icon from './Chain43113Icon';
        import Chain11155111Icon from './Chain11155111Icon';
        
        function ChainIcon(props) {
            const t = \`Chain\$\{props.id\}Icon\`;

            switch (props.id) {
                case "43113":
                    return <Chain43113Icon {...props} />;
                case "11155111":
                    return <Chain11155111Icon {...props} />;
                default:
                    return <Chain43113Icon {...props} />;
            }
        }

        export default ChainIcon;
    `
        , {
            presets: [['@babel/preset-react', { useBuiltIns: true }]],
        });

    if (format === 'cjs') {
        code = code
            .replace(
                'import * as React from "react";',
                'const React = require("react");'
            )
            .replace('export default', 'module.exports =');
    }

    await fs.writeFile(
        `${outDir}/ChainIcon.js`,
        code,
        'utf-8'
    )

    console.log('- Creating file: index.js');
    await fs.writeFile(
        `${outDir}/index.js`,
        indexFileContent(files, format),
        'utf-8'
    );
    await fs.writeFile(
        `${outDir}/index.d.ts`,
        indexFileContent(files, 'esm', false),
        'utf-8'
    );
}

async function buildChainIcons(format = 'esm') {
    await buildIcons(format, './optimized/chains');
}



(function main() {
    console.log('🏗 Building icon package...');
    new Promise((resolve) => {
        rimraf(`${outputPath}/*`, resolve);
    })
        .then(() => Promise.all([buildChainIcons('cjs'), buildChainIcons('esm')]))
        .then(() => console.log('✅ Finished building package.'));
})();