INSERT INTO Events
(
	Ack,AckBy,AckTime,Action,Actor,AdditionalInfo,AlarmCategorization1,AlarmCategorization2,AlarmCode,CAPEFlag,
	CMDBCIEnvironment,CMDBCIID,CMDBCIStatus,CMDBServiceID,ClearOrderKey,ClearTime,Company,Count,Customer,Department,
	Details,DeviceType,Duration,EMSAlarmID,EMSHost,EMSHostGroup,EMSIPAddress,EMSName,EMSService,EscalationFlag,
	EventCategory,EventKey,EventType,ExpireTime,FirstReported,GeoLocation,GeoPath,HelpKey,IPAddress,LastChanged,
	LastComment,LastReported,Location,Method,MsgGroup,NECard,NECluster,NEFirstReported,NELastReported,NEMilestone,
	NEMilestoneDescription,NEName,NEPort,NERNC,NERegion,NEShelf,NESlot,NETHS,Node,NodeAlias,
	OnCall,OrigSeverity,OwnedTime,OwnerName,ResendInterval,RootCauseFlag,RootCauseID,Score,Service,ServiceImpact,
	Severity,SubDeviceType,SubMethod,SubNode,Summary,Suppression,SuppressionList,Technology,TicketActionType,TicketAssignedGroup,
	TicketCategoryLevel1,TicketCategoryLevel2,TicketCategoryLevel3,TicketCustomerService,TicketEntryID,TicketFlag,TicketFollowUpTime,TicketID,TicketNotes,TicketRelatedIncNr,
	TicketRelationType,TicketSeverity,TicketStatus,TicketStatusReason,TicketSubmitTime,TicketSubmitter,TicketSystem,TicketUrgency,TicketVendor,TicketVendorTicketID,
	VisibleTime,ZoneID
)
VALUES
(
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,ST_GeomFromGeoJson(?,1,4326),ST_GeomFromGeoJson(?,1,4326),?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?,?,?,?,?,?,?,?,?,
	?,?
)
ON DUPLICATE KEY UPDATE
     Actor = VALUES(Method),
     Action = if(Severity = VALUES(Severity),							/* Default is "Insert" set on EventDefaults. */
                 'Deduplication',                                           /* Severity did not change */
                 'DeduplicationWithSevChange'                               /* Severity changed */
                 ),
     ClearOrderKey = VALUES(ClearOrderKey),
     ClearTime = if(EventCategory = 11, 								/*  For STATUS Events  */
                    case
                        when Severity > 0 and VALUES(Severity) = 0 then  /*  If Event is cleared */
                            unix_timestamp(curtime(3))                  	/*  set ClearTime */
                        when VALUES(Severity) = 0 then                 		 	/* If Clear deduplicates */
                            ClearTime                                /* keep existing ClearTime */
                    /* else null (default) */                       		/* remove ClearTime */
                        end,
                    if(Severity = 0 and VALUES(Severity) > 0, 			/*  All other Events, if event is Awake again, */
                       null, 												/*  remove ClearTime */
                       ClearTime 									/*  keep Existing ClearTime */
                    )
                 ),
     Count = Count + 1,
     Duration = VALUES(LastReported) - FirstReported,
     EMSAlarmID = VALUES(EMSAlarmID),
     EventCategory  = if (EventCategory = 3 and VALUES(EventCategory) = 1,   /* check handled resolutions */
                          VALUES(EventCategory),          							/* update EventCategory for resolutions as mechanization updates it. */
                          EventCategory                   				/* keep existing EventCategory */
                      ),
     ExpireTime = VALUES(ExpireTime),
     LastChanged  = unix_timestamp(curtime(3)),
     LastReported = VALUES(LastReported),
     NELastReported = VALUES(NELastReported),
     Severity =  if(EventCategory = 11,								/* For STATUS Events  */
                    VALUES(Severity),											/* Always Update to new Severity */
                    if(Severity = 0 AND VALUES(Severity) > 0,			/* For all other Events when old Severity=0 and new Severity > 0 -> Re-Awake the Event */
                       VALUES(Severity),										/* update Severity */
                       Severity										/* Else: Keep original Severity */
                    )
                 ),
     Summary =   if (Summary like 'Review Required: %',
                     concat('Review Required: ', VALUES(Summary)),
                     VALUES(Summary)
                 ),
     SuppressionList = if (JSON_CONTAINS_PATH(SuppressionList, 'one', '$."Hidden from NOC"."Rules EMS Severity"') !=  JSON_CONTAINS_PATH(VALUES(SuppressionList), 'one', '$."Hidden from NOC"."Rules EMS Severity"'),    /* "Rules EMS Severity" was added or removed */
                            if (JSON_CONTAINS_PATH(VALUES(SuppressionList), 'one', '$."Hidden from NOC"."Rules EMS Severity"'),   /* "Rules EMS Severity" was added */
                                JSON_MERGE_PATCH(SuppressionList, JSON_OBJECT('Hidden from NOC', JSON_OBJECT('Rules EMS Severity', JSON_EXTRACT(VALUES(SuppressionList), '$."Hidden from NOC"."Rules EMS Severity"')))),   /* add "Rules EMS Severity" */
                                JSON_REMOVE(SuppressionList, '$."Hidden from NOC"."Rules EMS Severity"')   /* remove "Rules EMS Severity" */
                            ),
                        SuppressionList
                     ),
     SuppressionList = if ( ifnull(JSON_LENGTH(JSON_EXTRACT(SuppressionList, '$."Hidden from NOC"')),0) = 0,  /* no more suppressions under "Hidden from NOC" */
                            JSON_REMOVE(SuppressionList, '$."Hidden from NOC"'),         /* remove "Hidden from NOC" */
                            SuppressionList
                     ),
     Suppression = if ( ifnull(JSON_LENGTH(JSON_EXTRACT(SuppressionList, '$')),0) = 0,   /* no more suppressions at all */
                        0,     /* set Suppression to 0 */
                        1      /* set Suppression to 1 */
     ),
     SubNode = VALUES(SubNode)