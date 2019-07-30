import React, {useState, useRef, useCallback} from 'react';
import styled from 'styled-components';
import useDimensions from '../hooks/useDimensions';
import useHover from '../hooks/useHover';

const transformEasing = ({active, transformOffset}) => {
  if (active) {
    return 0;
  }
  return `-${Math.round(transformOffset)}px`;
};

const opacityEasing = ({active}) => {
  if (active) {
    return 1;
  }
  return 0;
};

const Flyout = styled.div`
  transform: translateY(${transformEasing});
  opacity: ${opacityEasing};
  transition: transform 0.3s ease-in-out, opacity 0.35s ease-in;
  position: absolute;
  z-index: 1;
  background: #f5f6f6;
  width: 100%;
`;

const Main = styled.div`
  position: relative;
  background: #f5f6f6;
  z-index: 2;
`;

const ClickCatcher = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  z-index: 0;
`;

const HoverZone = styled.div`
  position: absolute;
  width: 100%;
  height: ${({height}) => height};
`;

const FlyoutContainer = styled.header`
  position: relative;
  z-index: 10;
  background: transparent;
  font-family: 'NeueHaasGrotDisp';
`;

const HeaderFlyout = (props) => {
  const {MainComponent, FlyoutComponent, disableFlyout, ...rest} = props;
  const [active, setActive] = useState(false);
  const mainRef = useRef();
  const {height: mainHeight = 0} = useDimensions(mainRef);
  const flyoutRef = useRef();
  const {height: flyoutHeight = 0} = useDimensions(flyoutRef);
  const transformOffset = mainHeight + flyoutHeight;
  const hoverZoneRef = useRef();
  const isHovering = useHover(hoverZoneRef);
  const hoverHeight = Math.round(flyoutHeight);
  const clickHandler = useCallback(() => {
    if (!isHovering) {
      setActive((a) => !a);
    }
  });

  return (
    <FlyoutContainer {...rest} innerRef={hoverZoneRef}>
      {active && <ClickCatcher onClick={clickHandler} />}
      <Main innerRef={mainRef} onClick={clickHandler}>
        <MainComponent tactile={!disableFlyout} />
      </Main>
      {!disableFlyout && (
        <Flyout innerRef={flyoutRef} active={isHovering || active} transformOffset={transformOffset}>
          <FlyoutComponent />
        </Flyout>
      )}
      {!disableFlyout && <HoverZone height={`${Math.round(hoverHeight)}px`} />}
    </FlyoutContainer>
  );
};

export default HeaderFlyout;
