import Layout from "@theme/Layout";
import React from "react";
import README from '../../../README.md';

const HomeSplash = props => {
    const { siteConfig, language = '' } = props;
    const { baseUrl, customFields } = siteConfig;
    const { docsUrl } = customFields;
    const docsPart = `${docsUrl ? `${docsUrl}/` : ''}`;
    const langPart = `${language ? `${language}/` : ''}`;
    const docUrl = doc => `${baseUrl}${docsPart}${langPart}${doc}`;

    const SplashContainer = props => (
        <div className="homeContainer">
            <div className="homeSplashFade">
                <div className="wrapper homeWrapper">{props.children}</div>
            </div>
        </div>
    );

    const Logo = props => (
        <div className="projectLogo">
            <img src={props.img_src} alt="Project Logo" />
        </div>
    );

        const Readme = props => (
            <div className="readme">{props.children}</div>
    );

    return (
        <SplashContainer>
            <Logo img_src={`${baseUrl}img/logo.png`} />
            <div className="inner">
                <Readme>
                    <README />
                </Readme>
            </div>
        </SplashContainer>
    );
}

const Index = props => {
    const { config: siteConfig, language = '' } = props;
    return (
        <Layout
            title="Home"
            description={siteConfig.tagline}>
            <main>
                <div padding={['bottom', 'top']} id="description" background="light">
                    <HomeSplash siteConfig={siteConfig} language={language} />
                </div>
            </main>
        </Layout>
    );
}

export default Index;
