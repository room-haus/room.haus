import React from 'react'
import styled from 'styled-components';

const MixContainer = styled.div`
    position: relative
`;

const TextContainer = styled.div`
    top: 0;
    left: 0;
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-end;

    > * {
        color: #FFFFFF;
        font-size: 2.4em;
        line-height: 1.3;
        margin: 0 0 .5rem .5rem;
    }

    > *:last-child {
        margin: 0 .5rem .5rem auto;
        font-size: 1.5em;
    }
`;

const MixArt = styled.img`
    position: relative;
    width: 100%;
    margin: 0;
    user-drag: none;
    vertical-align: middle;
`;

const FeaturedMix = ({image, children, mixId}) => (
    <MixContainer>
        <MixArt src={image} />
        <TextContainer>
            <span>{children}</span>
            <span>{mixId}</span>
        </TextContainer>
    </MixContainer>
);


export default FeaturedMix;
