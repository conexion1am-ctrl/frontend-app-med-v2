import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import AceptarInvitacionScreen from '../screens/AceptarInvitacionScreen';

// Puente de Expo Router: cuando alguien abre el link
// frontendappmedv2://invitacion/ABC123 (o su versión https equivalente),
// esta ruta captura el "token" de la URL y se lo pasa a la pantalla real.
export default function InvitacionRoute() {
  const { token } = useLocalSearchParams();

  return (
    <AceptarInvitacionScreen
      route={{ params: { token } }}
      navigation={{
        replace: (nombre) => {
          // Redirige usando el router de Expo hacia la pantalla de Ingresar
          const { router } = require('expo-router');
          router.replace(nombre === 'Ingresar' ? '/' : '/');
        },
      }}
    />
  );
}
