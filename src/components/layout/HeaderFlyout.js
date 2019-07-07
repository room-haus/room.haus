import React, {useState, useRef} from 'react';
import styled from 'styled-components';
import useDimensions from '../../hooks/useDimensions';
import useMousePosition from '../../hooks/useMousePosition';
import DebuggerWindow from '../utils/DebuggerWindow';

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
  transition: transform 0.2s ease-in-out, opacity 0.3s ease-in;
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

const FlyoutContainer = styled.header`
  max-width: 100%;
  position: relative;
  z-index: 10;
  background: transparent;
  font-family: 'NeueHaasGrotDisp';
`;

const HeaderFlyout = (props) => {
  const {MainComponent, FlyoutComponent, flyoutType, ...rest} = props;
  const [active, setActive] = useState(false);
  const mainRef = useRef();
  const {height: mainHeight = 0} = useDimensions(mainRef);
  const flyoutRef = useRef();
  const {height: flyoutHeight = 0} = useDimensions(flyoutRef);
  const transformOffset = mainHeight + flyoutHeight;
  // const menuHeight = 60 + 54;
  // const threshold = menuHeight + 300;
  // const {y} = useMousePosition(document);
  // const active = y <= threshold;
  return (
    <FlyoutContainer {...rest}>
      {active && <ClickCatcher onClick={() => setActive((a) => !a)} />}
      <Main innerRef={mainRef} onClick={() => setActive((a) => !a)}>
        <MainComponent />
      </Main>
      <Flyout innerRef={flyoutRef} active={active} transformOffset={transformOffset}>
        <FlyoutComponent />
      </Flyout>
    </FlyoutContainer>
  );
};

export default HeaderFlyout;
