/**
 * Status Conversion Instructions Screen.
 * Shows users how to convert the Status property from Select to Status type in Notion.
 */

import { Stack, Text, Button, XStack, ScrollView } from 'tamagui';
import changeStatusImg from '../../assets/change-status-to-status.jpg';
import statusGroupsImg from '../../assets/status-groups.jpg';

interface StatusConversionScreenProps {
  onContinue: () => void;
}

export function StatusConversionScreen({
  onContinue,
}: StatusConversionScreenProps): React.JSX.Element {
  const handleContinue = async (): Promise<void> => {
    await window.electron.ipcRenderer.invoke('notion:confirmStatusMigration');
    onContinue();
  };
  return (
    <ScrollView flex={1}>
      <Stack
        flex={1}
        padding='$6'
        gap='$4'
        maxWidth={800}
        alignSelf='center'
      >
        <Stack gap='$2'>
          <Text
            fontSize='$8'
            fontWeight='bold'
          >
            One More Step: Convert Status Property
          </Text>
          <Text
            fontSize='$5'
            color='$gray11'
          >
            Your databases are ready! To get the full workflow benefits of
            Notion's Status property, you'll need to convert the "Status" field
            from a Select to a Status property.
          </Text>
        </Stack>

        <Stack
          gap='$4'
          padding='$4'
          backgroundColor='$blue2'
          borderRadius='$4'
          borderWidth={1}
          borderColor='$blue6'
        >
          <Text
            fontSize='$4'
            fontWeight='600'
            color='$blue11'
          >
            Why Convert?
          </Text>
          <Text
            fontSize='$3'
            color='$gray12'
          >
            Status properties give you visual grouping (To-do, In Progress,
            Complete) and better workflow management. Your custom status values
            (Backlog, To-do, On Deck, In progress, BLOCKED, Done, Cancelled) are
            already set up - you just need to enable the Status property type!
          </Text>
        </Stack>

        <Stack gap='$3'>
          <Text
            fontSize='$6'
            fontWeight='600'
          >
            Step 1: Change Property Type
          </Text>
          <Text
            fontSize='$4'
            color='$gray11'
          >
            In your Tasks database, click on the "Status" property header, then
            select "Edit property" and change the type from "Select" to
            "Status".
          </Text>
          <Stack
            borderRadius='$4'
            overflow='hidden'
            borderWidth={1}
            borderColor='$gray6'
          >
            <img
              src={changeStatusImg}
              alt='Change Status property type from Select to Status'
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </Stack>
        </Stack>

        <Stack gap='$3'>
          <Text
            fontSize='$6'
            fontWeight='600'
          >
            Step 2: Organize Status Groups
          </Text>
          <Text
            fontSize='$4'
            color='$gray11'
          >
            After converting, organize your status values into the three main
            groups:
          </Text>
          <Stack
            gap='$2'
            paddingLeft='$4'
          >
            <Text
              fontSize='$4'
              color='$gray12'
            >
              • <Text fontWeight='600'>To-do:</Text> Backlog, To-do, On Deck
            </Text>
            <Text
              fontSize='$4'
              color='$gray12'
            >
              • <Text fontWeight='600'>In Progress:</Text> In progress, BLOCKED
            </Text>
            <Text
              fontSize='$4'
              color='$gray12'
            >
              • <Text fontWeight='600'>Complete:</Text> Done, Cancelled
            </Text>
          </Stack>
          <Stack
            borderRadius='$4'
            overflow='hidden'
            borderWidth={1}
            borderColor='$gray6'
            marginTop='$2'
          >
            <img
              src={statusGroupsImg}
              alt='Organize status values into groups'
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </Stack>
        </Stack>

        <Stack
          gap='$3'
          padding='$4'
          backgroundColor='$gray2'
          borderRadius='$4'
          borderWidth={1}
          borderColor='$gray6'
        >
          <Text
            fontSize='$4'
            fontWeight='600'
          >
            💡 Pro Tip
          </Text>
          <Text
            fontSize='$3'
            color='$gray12'
          >
            You can drag and drop status values to reorder them within each
            group, and Notion will remember your preferred order!
          </Text>
        </Stack>

        <XStack
          gap='$3'
          justifyContent='flex-end'
          marginTop='$4'
        >
          <Button
            size='$5'
            onPress={handleContinue}
            themeInverse
          >
            I've Converted the Status Property
          </Button>
        </XStack>

        <Text
          fontSize='$2'
          color='$gray10'
          textAlign='center'
        >
          You can always do this later - the app will work fine with the Select
          property, but Status gives you better workflow features.
        </Text>
      </Stack>
    </ScrollView>
  );
}
